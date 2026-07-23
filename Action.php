<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
	exit;
}

class TEPoster_Action extends Typecho_Widget implements Widget_Interface_Do
{
	const MAX_IMAGE_BYTES = 8388608;

	public function action()
	{
		if (!$this->request->isGet()) {
			return $this->sendError(405, 'Method not allowed');
		}

		$url = trim((string)$this->request->get('url', ''));
		$token = trim((string)$this->request->get('token', ''));
		$options = Helper::options();
		$secret = isset($options->secret) ? (string)$options->secret : '';
		$parts = $url !== '' ? parse_url($url) : false;
		$scheme = $parts && isset($parts['scheme']) ? strtolower($parts['scheme']) : '';

		if ($secret === '' || !$parts || empty($parts['host']) || !in_array($scheme, ['http', 'https'], true)) {
			return $this->sendError(400, 'Invalid image URL');
		}
		$expectedToken = hash_hmac('sha256', $url, $secret);
		if ($token === '' || !hash_equals($expectedToken, $token)) {
			return $this->sendError(403, 'Invalid image token');
		}
		if (!empty($parts['user']) || !empty($parts['pass'])) {
			return $this->sendError(400, 'Invalid image URL');
		}

		$host = trim((string)$parts['host'], '[]');
		$ip = $this->resolvePublicIp($host);
		if ($ip === '') {
			return $this->sendError(403, 'Image host is not allowed');
		}
		if (!function_exists('curl_init')) {
			return $this->sendError(503, 'Image proxy requires cURL');
		}

		$result = $this->fetchImage($url, $host, $ip, $scheme, isset($parts['port']) ? (int)$parts['port'] : null);
		if (!$result['ok']) {
			return $this->sendError($result['status'], $result['message']);
		}

		$this->response->setStatus(200);
		$this->response->setHeader('Content-Type', $result['mime']);
		$this->response->setHeader('Content-Length', (string)strlen($result['body']));
		$this->response->setHeader('Cache-Control', 'public, max-age=86400');
		$this->response->setHeader('X-Content-Type-Options', 'nosniff');
		echo $result['body'];
	}

	private function resolvePublicIp($host)
	{
		if (filter_var($host, FILTER_VALIDATE_IP)) {
			return $this->isPublicIp($host) ? $host : '';
		}

		$ipv4 = @gethostbynamel($host);
		if (is_array($ipv4)) {
			foreach ($ipv4 as $ip) {
				if ($this->isPublicIp($ip)) {
					return $ip;
				}
			}
		}

		if (function_exists('dns_get_record') && defined('DNS_AAAA')) {
			$records = @dns_get_record($host, DNS_AAAA);
			if (is_array($records)) {
				foreach ($records as $record) {
					if (!empty($record['ipv6']) && $this->isPublicIp($record['ipv6'])) {
						return $record['ipv6'];
					}
				}
			}
		}

		return '';
	}

	private function isPublicIp($ip)
	{
		return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
	}

	private function fetchImage($url, $host, $ip, $scheme, $explicitPort)
	{
		$body = '';
		$tooLarge = false;
		$port = $explicitPort ?: ($scheme === 'https' ? 443 : 80);
		$pinnedIp = strpos($ip, ':') !== false ? '[' . $ip . ']' : $ip;
		$ch = curl_init($url);
		curl_setopt_array($ch, [
			CURLOPT_FOLLOWLOCATION => false,
			CURLOPT_CONNECTTIMEOUT => 4,
			CURLOPT_TIMEOUT => 10,
			CURLOPT_NOSIGNAL => true,
			CURLOPT_SSL_VERIFYPEER => true,
			CURLOPT_SSL_VERIFYHOST => 2,
			CURLOPT_USERAGENT => 'TEPoster/1.2.0 Image Proxy',
			CURLOPT_HTTPHEADER => ['Accept: image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8'],
			CURLOPT_RESOLVE => [$host . ':' . $port . ':' . $pinnedIp],
			CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use (&$body, &$tooLarge) {
				if (strlen($body) + strlen($chunk) > self::MAX_IMAGE_BYTES) {
					$tooLarge = true;
					return 0;
				}
				$body .= $chunk;
				return strlen($chunk);
			}
		]);
		if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
			curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
		}

		$ok = curl_exec($ch);
		$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		if ($tooLarge) {
			return ['ok' => false, 'status' => 413, 'message' => 'Image is too large'];
		}
		if ($ok === false || $status < 200 || $status >= 300 || $body === '') {
			return ['ok' => false, 'status' => 502, 'message' => 'Unable to fetch image'];
		}

		$imageInfo = @getimagesizefromstring($body);
		$mime = is_array($imageInfo) && !empty($imageInfo['mime']) ? strtolower((string)$imageInfo['mime']) : '';
		$allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
		if (!in_array($mime, $allowedMimes, true)) {
			return ['ok' => false, 'status' => 415, 'message' => 'Unsupported image type'];
		}

		return ['ok' => true, 'status' => 200, 'message' => '', 'mime' => $mime, 'body' => $body];
	}

	private function sendError($status, $message)
	{
		$this->response->setStatus((int)$status);
		$this->response->setContentType('text/plain');
		$this->response->setHeader('Cache-Control', 'no-store');
		$this->response->setHeader('X-Content-Type-Options', 'nosniff');
		echo $message;
	}
}
