<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
	exit;
}

/**
 * 文章页生成海报，调用：TEPoster_Plugin::insertButton()
 * @package TEPoster
 * @author 森木志
	 * @version 1.11.0
 * @link https://oxxx.cn
 *
 */
class TEPoster_Plugin implements Typecho_Plugin_Interface
{
	/**
	 * 启用插件
	 */
	public static function activate()
	{
		Typecho_Plugin::factory('Widget_Archive')->footer = ['TEPoster_Plugin', 'footer'];
		return _t('TEPoster 插件已启用');
	}

	/**
	 * 禁用插件
	 */
	public static function deactivate()
	{
		return _t('TEPoster 插件已禁用');
	}

	/**
	 * 插件设置
	 */
	public static function config(Typecho_Widget_Helper_Form $form)
	{
		$logoUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'logoUrl', null, '', _t('Logo URL'), _t('用于海报底部品牌区域；留空时显示网站标题。')
		);

		$buttonClass = new Typecho_Widget_Helper_Form_Element_Text(
			'buttonClass', null, 'teposter-btn', _t('按钮 CSS 类名'), _t('用于适配主题中的海报按钮样式，例如 OneBlog 可填写 submit。')
		);

		$posterWidth = new Typecho_Widget_Helper_Form_Element_Text(
			'posterWidth', null, '400', _t('海报宽度（px）'), _t('建议 360-600 之间。默认 400。')
		);

		$imageSource = new Typecho_Widget_Helper_Form_Element_Radio(
			'imageSource',
			[
				'default' => _t('默认图'),
				'thumb' => _t('文章封面优先'),
				'unsplash' => _t('Unsplash 随机图')
			],
			'default',
			_t('图片来源'),
			_t('文章封面模式会依次尝试自定义字段、正文首图和 og:image。')
		);

		$defaultImageUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'defaultImageUrl', null, '', _t('默认图 URL'), _t('留空时使用插件内置的 assets/poster.webp。')
		);

		$customCoverField = new Typecho_Widget_Helper_Form_Element_Text(
			'customCoverField', null, 'thumb', _t('自定义封面字段'), _t('文章封面模式优先读取该字段，例如 thumb。')
		);

		$unsplashAccessKey = new Typecho_Widget_Helper_Form_Element_Text(
			'unsplashAccessKey', null, '', _t('Unsplash Access Key'), _t('在 Unsplash Developers 创建应用后填写 Access Key。')
		);

		$unsplashKeywords = new Typecho_Widget_Helper_Form_Element_Text(
			'unsplashKeywords', null, '', _t('Unsplash 关键词'), _t('例如 nature、city；留空时不限制主题。')
		);

		$posterStyle = new Typecho_Widget_Helper_Form_Element_Radio(
			'posterStyle',
			[
				'default' => _t('默认'),
				'ninetheme' => _t('ninetheme'),
				'netease' => _t('网易云'),
				'minimal' => _t('深色卡片')
			],
			'default',
			_t('海报样式'),
			_t('选择文章海报的排版样式。')
		);

		$qrSizeDefault = new Typecho_Widget_Helper_Form_Element_Text(
			'qrSizeDefault', null, '130', _t('二维码大小（px）'), _t('默认样式使用，默认 130。')
		);

		$qrSizeNinetheme = new Typecho_Widget_Helper_Form_Element_Text(
			'qrSizeNinetheme', null, '75', _t('二维码大小（px）'), _t('ninetheme 样式使用，默认 75。')
		);

		$ntBrandDesc = new Typecho_Widget_Helper_Form_Element_Text(
			'ntBrandDesc', null, '', _t('底部品牌描述'), _t('ninetheme 样式中显示在网站名称下方。')
		);

		$minimalIdentity = new Typecho_Widget_Helper_Form_Element_Radio(
			'minimalIdentity',
			[
				'site' => _t('网站信息'),
				'author' => _t('文章作者')
			],
			'site',
			_t('深色卡片底部'),
			_t('选择显示圆形 favicon 与网站名，或圆形作者头像与作者名。')
		);

		$assetSource = new Typecho_Widget_Helper_Form_Element_Radio(
			'assetSource',
			[
				'local' => _t('本地文件（推荐）'),
				'cdn' => _t('外部 CDN')
			],
			'local',
			_t('依赖来源'),
			_t('控制 html2canvas 与 qrcode.js 的加载地址。')
		);

		$cdnHtml2canvasUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'cdnHtml2canvasUrl', null, 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', _t('html2canvas CDN 地址'), _t('仅在依赖来源选择外部 CDN 时使用。')
		);

		$cdnQrcodeUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'cdnQrcodeUrl', null, 'https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js', _t('qrcode.js CDN 地址'), _t('仅在依赖来源选择外部 CDN 时使用。')
		);

		$customCss = new Typecho_Widget_Helper_Form_Element_Textarea(
			'customCss', null, '', _t('自定义 CSS'), _t('附加到海报与按钮的自定义样式。')
		);

		try {
			$qrSizeDefault->container->setAttribute('data-teposter-show-when', 'style:default');
			$qrSizeNinetheme->container->setAttribute('data-teposter-show-when', 'style:ninetheme');
			$ntBrandDesc->container->setAttribute('data-teposter-show-when', 'style:ninetheme');
			$minimalIdentity->container->setAttribute('data-teposter-show-when', 'style:minimal');
			$defaultImageUrl->container->setAttribute('data-teposter-show-when', 'source:default');
			$customCoverField->container->setAttribute('data-teposter-show-when', 'source:thumb');
			$unsplashAccessKey->container->setAttribute('data-teposter-show-when', 'source:unsplash');
			$unsplashKeywords->container->setAttribute('data-teposter-show-when', 'source:unsplash');
			$cdnHtml2canvasUrl->container->setAttribute('data-teposter-show-when', 'asset:cdn');
			$cdnQrcodeUrl->container->setAttribute('data-teposter-show-when', 'asset:cdn');
			foreach ([$assetSource, $cdnHtml2canvasUrl, $cdnQrcodeUrl, $customCss] as $advancedField) {
				$advancedField->container->setAttribute('data-teposter-section', 'advanced');
			}
		} catch (\Throwable $e) {}

		$form->setAttribute('class', 'teposter-admin-form');

		self::addConfigSection($form, 'basic', _t('基础设置'), _t('网站品牌、触发按钮和海报内容范围。'));
		$form->addInput($logoUrl);
		$form->addInput($buttonClass);
		$form->addInput($posterWidth);

		self::addConfigSection($form, 'image', _t('图片设置'), _t('选择海报封面的获取方式。'));
		$form->addInput($imageSource);
		$form->addInput($defaultImageUrl);
		$form->addInput($customCoverField);
		$form->addInput($unsplashAccessKey);
		$form->addInput($unsplashKeywords);

		self::addConfigSection($form, 'style', _t('样式设置'), _t('选择版式并调整当前样式支持的选项。'));
		$form->addInput($posterStyle);
		$form->addInput($qrSizeDefault);
		$form->addInput($qrSizeNinetheme);
		$form->addInput($ntBrandDesc);
		$form->addInput($minimalIdentity);

		self::addConfigSection($form, 'advanced', _t('高级设置'), _t('依赖来源、CDN 地址与自定义 CSS。'), true);
		$form->addInput($assetSource);
		$form->addInput($cdnHtml2canvasUrl);
		$form->addInput($cdnQrcodeUrl);
		$form->addInput($customCss);

		echo <<<'TEPOSTER_ADMIN'
<style>
.teposter-admin-form { max-width: 720px; }
.teposter-admin-section { margin: 32px 0 18px; padding-top: 26px; border-top: 1px solid #e2e5e8; }
.teposter-admin-section.is-first { margin-top: 4px; padding-top: 0; border-top: 0; }
.teposter-admin-section h3 { margin: 0; color: #2f3337; font-size: 18px; line-height: 1.35; }
.teposter-admin-section p { margin: 6px 0 0; color: #8a9097; font-size: 13px; line-height: 1.6; }
.teposter-admin-section-toggle { width: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; display: flex; align-items: center; justify-content: space-between; text-align: left; }
.teposter-admin-section-toggle:focus { outline: 2px solid #467b96; outline-offset: 4px; }
.teposter-admin-section-icon { flex: 0 0 auto; color: #667078; font-size: 20px; font-weight: 400; line-height: 1; }
.teposter-admin-form > ul.typecho-option { margin-bottom: 18px; }
.teposter-admin-form > ul.typecho-option > li > span { display: inline-flex; align-items: center; max-width: 100%; margin: 0 20px 8px 0; white-space: normal; }
.teposter-admin-form > ul.typecho-option > li > span label { margin-left: 5px; overflow-wrap: anywhere; }
.teposter-admin-form input.text,
.teposter-admin-form textarea { width: 100%; max-width: 100%; box-sizing: border-box; }
.teposter-admin-form textarea { min-height: 120px; resize: vertical; }
@media (max-width: 767px) {
  .teposter-admin-section { margin-top: 26px; padding-top: 22px; }
  .teposter-admin-form > ul.typecho-option > li > span { display: flex; margin-right: 0; }
}
</style>
<script>
(function () {
  function initTEPosterAdmin() {
    var form = document.querySelector('form.teposter-admin-form');
    if (!form || form.getAttribute('data-teposter-ready') === '1') return;
    form.setAttribute('data-teposter-ready', '1');

    var advancedOpen = false;
    var advancedToggle = form.querySelector('[data-teposter-advanced-toggle]');

    function currentValue(name, fallback) {
      var checked = form.querySelector('input[name="' + name + '"]:checked');
      return checked ? checked.value : fallback;
    }

    function matchesRule(field) {
      var value = field.getAttribute('data-teposter-show-when');
      if (!value) return true;
      var state = {
        style: currentValue('posterStyle', 'default'),
        source: currentValue('imageSource', 'default'),
        asset: currentValue('assetSource', 'local')
      };
      return value.split(' ').some(function (rule) {
        var parts = rule.split(':');
        return parts.length === 2 && state[parts[0]] === parts[1];
      });
    }

    function refreshFields() {
      var fields = form.querySelectorAll('[data-teposter-show-when], [data-teposter-section]');
      Array.prototype.forEach.call(fields, function (field) {
        var visible = matchesRule(field);
        if (field.getAttribute('data-teposter-section') === 'advanced' && !advancedOpen) {
          visible = false;
        }
        var row = field.closest ? field.closest('ul.typecho-option') : field.parentNode;
        if (row) row.style.display = visible ? '' : 'none';
      });
    }

    if (advancedToggle) {
      advancedToggle.addEventListener('click', function () {
        advancedOpen = !advancedOpen;
        advancedToggle.setAttribute('aria-expanded', advancedOpen ? 'true' : 'false');
        var icon = advancedToggle.querySelector('.teposter-admin-section-icon');
        if (icon) icon.textContent = advancedOpen ? '-' : '+';
        refreshFields();
      });
    }

    form.addEventListener('change', function (event) {
      var name = event.target && event.target.name;
      if (name === 'posterStyle' || name === 'imageSource' || name === 'assetSource') {
        refreshFields();
      }
    });

    refreshFields();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTEPosterAdmin);
  } else {
    initTEPosterAdmin();
  }
})();
</script>
TEPOSTER_ADMIN;
	}

	private static function addConfigSection(Typecho_Widget_Helper_Form $form, $id, $title, $description, $collapsible = false)
	{
		$className = 'teposter-admin-section' . ($id === 'basic' ? ' is-first' : '');
		$section = new Typecho_Widget_Helper_Layout('div', [
			'class' => $className,
			'data-teposter-section-heading' => $id
		]);

		if ($collapsible) {
			$toggle = new Typecho_Widget_Helper_Layout('button', [
				'type' => 'button',
				'class' => 'teposter-admin-section-toggle',
				'data-teposter-advanced-toggle' => '1',
				'aria-expanded' => 'false'
			]);
			$heading = new Typecho_Widget_Helper_Layout('h3');
			$heading->html(htmlspecialchars($title, ENT_QUOTES, 'UTF-8'));
			$icon = new Typecho_Widget_Helper_Layout('span', ['class' => 'teposter-admin-section-icon', 'aria-hidden' => 'true']);
			$icon->html('+');
			$toggle->addItem($heading);
			$toggle->addItem($icon);
			$section->addItem($toggle);
		} else {
			$heading = new Typecho_Widget_Helper_Layout('h3');
			$heading->html(htmlspecialchars($title, ENT_QUOTES, 'UTF-8'));
			$section->addItem($heading);
		}

		$summary = new Typecho_Widget_Helper_Layout('p');
		$summary->html(htmlspecialchars($description, ENT_QUOTES, 'UTF-8'));
		$section->addItem($summary);
		$form->addItem($section);
	}


	public static function personalConfig(Typecho_Widget_Helper_Form $form)
	{
	}

	/**
	 * 模板手动插入按钮
	 */
	public static function insertButton()
	{
		$options = Helper::options();
		$pluginOptions = $options->plugin('TEPoster');
		$buttonClass = !empty($pluginOptions->buttonClass) ? (string)$pluginOptions->buttonClass : 'teposter-btn';
		$widget = Typecho_Widget::widget('Widget_Archive');
		$postContext = self::getPostContext($widget, $pluginOptions);
		echo '<div class="teposter-button-wrap"><button type="button" class="' . htmlspecialchars($buttonClass, ENT_QUOTES, 'UTF-8') . '" id="teposter-generate" data-teposter-post-cover="' . htmlspecialchars($postContext['cover'], ENT_QUOTES, 'UTF-8') . '" data-teposter-post-date="' . htmlspecialchars($postContext['date'], ENT_QUOTES, 'UTF-8') . '" data-teposter-post-author="' . htmlspecialchars($postContext['author'], ENT_QUOTES, 'UTF-8') . '" data-teposter-post-author-avatar="' . htmlspecialchars($postContext['authorAvatar'], ENT_QUOTES, 'UTF-8') . '">' . _t('海报') . '</button></div>' . "\n";
	}

	private static function getPostContext($widget, $pluginOptions)
	{
		$context = ['cover' => '', 'date' => '', 'author' => '', 'authorAvatar' => ''];
		if (!$widget || !$widget->is('single')) {
			return $context;
		}

		if (isset($widget->created) && is_numeric($widget->created)) {
			$context['date'] = date('c', (int)$widget->created);
		}
		try {
			$accountAuthor = isset($widget->author->screenName) ? trim((string)$widget->author->screenName) : '';
			$customAuthor = '';
			if (isset($widget->fields) && $widget->fields && isset($widget->fields->author)) {
				$customAuthor = trim((string)$widget->fields->author);
			}
			$context['author'] = $customAuthor !== '' ? $customAuthor : $accountAuthor;
			$usesDifferentCustomAuthor = $customAuthor !== '' && $customAuthor !== $accountAuthor;

			if ($customAuthor !== '' && isset($widget->fields) && $widget->fields) {
				foreach (['authorAvatar', 'author_avatar', 'avatarUrl', 'avatar_url', 'avatar'] as $avatarField) {
					if (isset($widget->fields->{$avatarField}) && trim((string)$widget->fields->{$avatarField}) !== '') {
						$customAvatar = trim((string)$widget->fields->{$avatarField});
						if (strpos($customAvatar, '<') === false) {
							$context['authorAvatar'] = $customAvatar;
							break;
						}
					}
				}
			}

			if ($context['authorAvatar'] === '' && !$usesDifferentCustomAuthor && isset($widget->author->mail) && trim((string)$widget->author->mail) !== '') {
				$mail = trim((string)$widget->author->mail);
				if (function_exists('getGravatar')) {
					try {
						$themeAvatar = trim((string)getGravatar($mail, 96));
						if ($themeAvatar !== '' && strpos($themeAvatar, '<') === false) {
							$context['authorAvatar'] = $themeAvatar;
						}
					} catch (\Throwable $e) {}
				}
				if ($context['authorAvatar'] === '' && class_exists('Typecho_Common')) {
					$context['authorAvatar'] = Typecho_Common::gravatarUrl($mail, 96, 'G', 'identicon', true);
				} elseif ($context['authorAvatar'] === '' && class_exists('Typecho\\Common')) {
					$context['authorAvatar'] = \Typecho\Common::gravatarUrl($mail, 96, 'G', 'identicon', true);
				}
				$context['authorAvatar'] = html_entity_decode($context['authorAvatar'], ENT_QUOTES, 'UTF-8');
			}
		} catch (\Throwable $e) {}

		try {
			$fieldCandidates = [];
			if (!empty($pluginOptions->customCoverField)) {
				$fieldCandidates[] = (string)$pluginOptions->customCoverField;
			}
			$fieldCandidates = array_merge($fieldCandidates, [
				'image',
				'thumb',
				'thumbnail',
				'cover',
				'banner',
				'headerImage',
				'imageUrl',
				'img',
				'imgUrl',
				'postImage',
				'bannerUrl',
				'bannerurl',
				'coverUrl',
				'coverurl',
				'header_image',
				'image_url',
				'img_url',
				'post_image'
			]);
			$fieldCandidates = array_values(array_unique(array_filter($fieldCandidates)));
			if (isset($widget->fields) && $widget->fields) {
				foreach ($fieldCandidates as $fieldName) {
					if (isset($widget->fields->{$fieldName}) && !empty($widget->fields->{$fieldName})) {
						$context['cover'] = (string)$widget->fields->{$fieldName};
						break;
					}
				}
			}
		} catch (\Throwable $e) {
			if (defined('__TYPECHO_DEBUG__') && __TYPECHO_DEBUG__) {
				error_log('TEPoster Plugin Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
			}
		}

		return $context;
	}

	public static function footer($archive = null)
	{
		$widget = ($archive instanceof Widget_Archive) ? $archive : Typecho_Widget::widget('Widget_Archive');
		$isSingle = $widget->is('single');

		$options = Helper::options();
		$pluginUrl = rtrim($options->pluginUrl, '/') . '/TEPoster';
		$pluginOptions = $options->plugin('TEPoster');

		$postContext = self::getPostContext($widget, $pluginOptions);

		$assetSource = !empty($pluginOptions->assetSource) ? (string)$pluginOptions->assetSource : 'local';
		$cdnHtml2canvasUrl = !empty($pluginOptions->cdnHtml2canvasUrl) ? (string)$pluginOptions->cdnHtml2canvasUrl : 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
		$cdnQrcodeUrl = !empty($pluginOptions->cdnQrcodeUrl) ? (string)$pluginOptions->cdnQrcodeUrl : 'https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js';
		$localHtml2canvasUrl = $pluginUrl . '/assets/vendor/html2canvas.min.js?v=1.4.1';
		$localQrcodeUrl = $pluginUrl . '/assets/vendor/qrcode.min.js?v=0.0.2';

		$cfg = [
			'buttonClass' => !empty($pluginOptions->buttonClass) ? (string)$pluginOptions->buttonClass : 'teposter-btn',
			'posterWidth' => isset($pluginOptions->posterWidth) ? intval($pluginOptions->posterWidth) : 400,
			// 兼容旧版 qrSize：如存在则作为两者的后备
			'qrSizeDefault' => isset($pluginOptions->qrSizeDefault) ? intval($pluginOptions->qrSizeDefault) : (isset($pluginOptions->qrSize) ? intval($pluginOptions->qrSize) : 130),
			'qrSizeNinetheme' => isset($pluginOptions->qrSizeNinetheme) ? intval($pluginOptions->qrSizeNinetheme) : (isset($pluginOptions->qrSize) ? intval($pluginOptions->qrSize) : 75),
			'logoUrl' => !empty($pluginOptions->logoUrl) ? (string)$pluginOptions->logoUrl : '',
			'unsplashKeywords' => !empty($pluginOptions->unsplashKeywords) ? (string)$pluginOptions->unsplashKeywords : '',
			'unsplashAccessKey' => !empty($pluginOptions->unsplashAccessKey) ? (string)$pluginOptions->unsplashAccessKey : '',
			'customCoverField' => !empty($pluginOptions->customCoverField) ? (string)$pluginOptions->customCoverField : 'thumb',
			'postCustomCover' => $postContext['cover'],
			'postDateISO' => $postContext['date'],
			'postAuthor' => $postContext['author'],
			'postAuthorAvatar' => $postContext['authorAvatar'],
			'imageSource' => !empty($pluginOptions->imageSource) ? (string)$pluginOptions->imageSource : 'default',
			'posterStyle' => !empty($pluginOptions->posterStyle) ? (string)$pluginOptions->posterStyle : 'default',
			'minimalIdentity' => !empty($pluginOptions->minimalIdentity) ? (string)$pluginOptions->minimalIdentity : 'site',
			'siteTitle' => isset($options->title) ? (string)$options->title : '',
			'ntBrandDesc' => !empty($pluginOptions->ntBrandDesc) ? (string)$pluginOptions->ntBrandDesc : '',
			'assetsBase' => $pluginUrl . '/assets',
			'defaultImage' => !empty($pluginOptions->defaultImageUrl) ? (string)$pluginOptions->defaultImageUrl : ($pluginUrl . '/assets/poster.webp'),
			'cdnHtml2canvasUrl' => $cdnHtml2canvasUrl,
			'cdnQrcodeUrl' => $cdnQrcodeUrl,
			'localHtml2canvasUrl' => $localHtml2canvasUrl,
			'localQrcodeUrl' => $localQrcodeUrl,
			'assetSource' => $assetSource,
		];

		echo '<link rel="stylesheet" href="' . $cfg['assetsBase'] . '/teposter.css?v=20" />' . "\n";
		if (!empty($pluginOptions->customCss)) {
			echo '<style id="teposter-custom-css">' . $pluginOptions->customCss . '</style>' . "\n";
		}

		echo '<script>window.TEPosterConfig = ' . json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script>' . "\n";
		echo '<script src="' . $cfg['assetsBase'] . '/teposter.js?v=25"></script>' . "\n";
	}
}
