<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
	exit;
}

/**
 * 文章页生成海报，调用：TEPoster_Plugin::insertButton()
 * @package TEPoster
 * @author 森木志
 * @version 1.1.2
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
		// 顶部“通用设置”开关（点击展开/收起）
		echo '<ul class="typecho-option" id="teposter-general-toggle" style="user-select:none;cursor:pointer;"><li><label class="typecho-label">通用设置</label><p class="description">点击展开/收起以下通用配置</p></li></ul>' . "\n";
		// 防止展开时后台出现/消失滚动条导致页面抖动：固定滚动条槽位
		echo '<style id="teposter-stable-scroll">html{scrollbar-gutter:stable both-edges;}body{overflow-y:scroll;}</style>' . "\n";

		$logoUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'logoUrl', null, '', _t('Logo URL'), _t('网站 Logo 图片地址（可选）。')
		);
		$form->addInput($logoUrl);

		$unsplashKeywords = new Typecho_Widget_Helper_Form_Element_Text(
			'unsplashKeywords', null, '', _t('Unsplash 关键词'), _t('随机图关键词（如 nature, city），留空则不限制。')
		);
		// 延后添加到 imageSource 下方

		$unsplashAccessKey = new Typecho_Widget_Helper_Form_Element_Text(
			'unsplashAccessKey', null, '', _t('Unsplash Access Key'), _t('在 Unsplash Developers 创建应用，填入 Access Key（前端调用随机图 API）。')
		);
		// 延后添加到 imageSource 下方

		$customCoverField = new Typecho_Widget_Helper_Form_Element_Text(
			'customCoverField', null, 'thumb', _t('自定义封面字段名'), _t('优先从该自定义字段取封面图（如 thumb）。')
		);
		// 延后添加到 imageSource 下方

		// 默认图自定义地址（仅在图片来源=默认图时展开）
		$defaultImageUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'defaultImageUrl', null, '', _t('默认图 URL（可选）'), _t('仅在“图片来源=默认图”时使用；留空则使用插件内置 poster.webp。')
		);
		// 延后添加到 imageSource 下方

		$imageSource = new Typecho_Widget_Helper_Form_Element_Radio(
			'imageSource',
			[
				'default' => _t('默认图（assets/poster.webp）'),
				'thumb' => _t('封面图优先（正文首图 → og:image）'),
				'unsplash' => _t('Unsplash 随机图')
			],
			'default',
			_t('图片来源'),
			_t('未选择或选“默认图”时，使用插件内置的 poster.webp。')
		);
		// 注意：图片来源控件将放到“通用设置”分组之后再加入

		$buttonClass = new Typecho_Widget_Helper_Form_Element_Text(
			'buttonClass', null, 'teposter-btn', _t('按钮 CSS 类名'), _t('用于自定义按钮样式的类名，如果你使用的是OneBlog主题可以填写：submit')
		);
		$form->addInput($buttonClass);

		$posterWidth = new Typecho_Widget_Helper_Form_Element_Text(
			'posterWidth', null, '400', _t('海报宽度（px）'), _t('建议 360-600 之间。默认 400。')
		);
		$form->addInput($posterWidth);

		// 二维码大小（按样式分别设置）
		$qrSizeDefault = new Typecho_Widget_Helper_Form_Element_Text(
			'qrSizeDefault', null, '130', _t('默认样式：二维码大小（px）'), _t('默认样式的二维码边长，默认 130。')
		);
		// 延后添加到 posterStyle 下方
		$qrSizeNinetheme = new Typecho_Widget_Helper_Form_Element_Text(
			'qrSizeNinetheme', null, '75', _t('ninetheme：二维码大小（px）'), _t('ninetheme 样式的二维码边长，默认 75。')
		);
		// 延后添加到 posterStyle 下方

		$summaryLength = new Typecho_Widget_Helper_Form_Element_Text(
			'summaryLength', null, '60', _t('摘要字数'), _t('默认 60（按字符数截取，仅在行数归并策略前使用）。')
		);
		$form->addInput($summaryLength);

		$cdnHtml2canvasUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'cdnHtml2canvasUrl', null, 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', _t('html2canvas 地址'), _t('可使用 CDN 或本地文件地址。')
		);
		$form->addInput($cdnHtml2canvasUrl);

		$cdnQrcodeUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'cdnQrcodeUrl', null, 'https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js', _t('qrcode.js 地址'), _t('可使用 CDN 或本地文件地址。')
		);
		$form->addInput($cdnQrcodeUrl);

		$customCss = new Typecho_Widget_Helper_Form_Element_Textarea(
			'customCss', null, '', _t('自定义 CSS'), _t('附加到海报与按钮的自定义样式。')
		);
		$form->addInput($customCss);

		// 标记“通用设置”分组
		try {
			$logoUrl->container->setAttribute('data-teposter-group', 'general');
			$buttonClass->container->setAttribute('data-teposter-group', 'general');
			$posterWidth->container->setAttribute('data-teposter-group', 'general');
			$summaryLength->container->setAttribute('data-teposter-group', 'general');
			$cdnHtml2canvasUrl->container->setAttribute('data-teposter-group', 'general');
			$cdnQrcodeUrl->container->setAttribute('data-teposter-group', 'general');
			$customCss->container->setAttribute('data-teposter-group', 'general');
		} catch (\Throwable $e) {}

		// 现在加入“图片来源”控件以及其下方的附属设置，确保位置在通用设置之后
		$form->addInput($imageSource);
		$form->addInput($defaultImageUrl);
		$form->addInput($customCoverField);
		$form->addInput($unsplashAccessKey);
		$form->addInput($unsplashKeywords);

		// 海报样式选择
		$posterStyle = new Typecho_Widget_Helper_Form_Element_Radio(
			'posterStyle',
			[
				'default' => _t('默认样式'),
				'ninetheme' => _t('ninetheme 样式')
			],
			'default',
			_t('海报样式'),
			_t('选择不同的海报排版风格。')
		);
		$form->addInput($posterStyle);

		// 将不同样式的专属设置插入在样式单选框下方
		$form->addInput($qrSizeDefault);
		$form->addInput($qrSizeNinetheme);

		// ninetheme 样式专属设置
		$ntBrandDesc = new Typecho_Widget_Helper_Form_Element_Text(
			'ntBrandDesc', null, '', _t('ninetheme：描述'), _t('显示在名称下方的一行描述。')
		);
		$form->addInput($ntBrandDesc);

		// 设置项显隐逻辑：根据海报样式 / 图片来源切换
		try {
			$qrSizeDefault->container->setAttribute('data-teposter-show-when', 'style:default');
			$qrSizeNinetheme->container->setAttribute('data-teposter-show-when', 'style:ninetheme');
			$ntBrandDesc->container->setAttribute('data-teposter-show-when', 'style:ninetheme');
			$defaultImageUrl->container->setAttribute('data-teposter-show-when', 'source:default');
			$customCoverField->container->setAttribute('data-teposter-show-when', 'source:thumb');
			$unsplashAccessKey->container->setAttribute('data-teposter-show-when', 'source:unsplash');
			$unsplashKeywords->container->setAttribute('data-teposter-show-when', 'source:unsplash');
		} catch (\Throwable $e) {}

		// 注入控制显隐脚本（通用设置折叠 + 条件展开）
		echo '<script>(function(){function sh(){var s=(document.querySelector("input[name=posterStyle]:checked")||{}).value||"default";var src=(document.querySelector("input[name=imageSource]:checked")||{}).value||"default";document.querySelectorAll("[data-teposter-show-when]").forEach(function(el){var v=el.getAttribute("data-teposter-show-when");if(!v)return;var ok=false;v.split(" ").forEach(function(rule){var p=rule.split(":");if(p[0]==="style"&&p[1]===s)ok=true; if(p[0]==="source"&&p[1]===src)ok=true;});el.style.display=ok?"":"none";});}function initGeneral(){var t=document.getElementById("teposter-general-toggle");var list=[].slice.call(document.querySelectorAll("[data-teposter-group=general]"));if(!t||!list.length)return;var opened=false;function apply(){list.forEach(function(el){el.style.display=opened?"":"none";});var imgSrc=document.querySelector("#typecho-option-item-imageSource-"),ref=imgSrc&&imgSrc.parentNode; if(ref&&opened){ var g=document.querySelector("[data-teposter-group=general]"); if(g){ ref.insertBefore(g.parentNode, imgSrc); } } }t.addEventListener("click",function(){opened=!opened;apply();});apply();}document.addEventListener("change",function(e){if(e.target&&e.target.name&&(e.target.name==="posterStyle"||e.target.name==="imageSource")){sh();}});if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){sh();initGeneral();});}else{sh();initGeneral();}})();</script>' . "\n";
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
		echo '<div class="teposter-button-wrap"><button type="button" class="' . htmlspecialchars($buttonClass) . '" id="teposter-generate">' . _t('海报') . '</button></div>' . "\n";
	}

	public static function footer($archive = null)
	{
		$widget = ($archive instanceof Widget_Archive) ? $archive : Typecho_Widget::widget('Widget_Archive');
		$isSingle = $widget->is('single');

		$options = Helper::options();
		$pluginUrl = rtrim($options->pluginUrl, '/') . '/TEPoster';
		$pluginOptions = $options->plugin('TEPoster');

		$postCustomCover = '';
		if ($isSingle) {
			try {
				if (!empty($pluginOptions->customCoverField)) {
					$fieldName = (string)$pluginOptions->customCoverField;
					if (isset($widget->fields) && $widget->fields) {
						if (isset($widget->fields->{$fieldName}) && !empty($widget->fields->{$fieldName})) {
							$postCustomCover = (string)$widget->fields->{$fieldName};
						}
					}
				}
			} catch (Exception $e) {
			}
		}

		$cfg = [
			'buttonClass' => !empty($pluginOptions->buttonClass) ? (string)$pluginOptions->buttonClass : 'teposter-btn',
			'posterWidth' => isset($pluginOptions->posterWidth) ? intval($pluginOptions->posterWidth) : 400,
			// 兼容旧版 qrSize：如存在则作为两者的后备
			'qrSizeDefault' => isset($pluginOptions->qrSizeDefault) ? intval($pluginOptions->qrSizeDefault) : (isset($pluginOptions->qrSize) ? intval($pluginOptions->qrSize) : 130),
			'qrSizeNinetheme' => isset($pluginOptions->qrSizeNinetheme) ? intval($pluginOptions->qrSizeNinetheme) : (isset($pluginOptions->qrSize) ? intval($pluginOptions->qrSize) : 75),
			'summaryLength' => isset($pluginOptions->summaryLength) ? intval($pluginOptions->summaryLength) : 60,
			'logoUrl' => !empty($pluginOptions->logoUrl) ? (string)$pluginOptions->logoUrl : '',
			'unsplashKeywords' => !empty($pluginOptions->unsplashKeywords) ? (string)$pluginOptions->unsplashKeywords : '',
			'unsplashAccessKey' => !empty($pluginOptions->unsplashAccessKey) ? (string)$pluginOptions->unsplashAccessKey : '',
			'customCoverField' => !empty($pluginOptions->customCoverField) ? (string)$pluginOptions->customCoverField : 'thumb',
			'postCustomCover' => $postCustomCover,
			'postDateISO' => $isSingle ? date('c', $widget->created) : '',
			'imageSource' => !empty($pluginOptions->imageSource) ? (string)$pluginOptions->imageSource : 'default',
			'posterStyle' => !empty($pluginOptions->posterStyle) ? (string)$pluginOptions->posterStyle : 'default',
			'siteTitle' => isset($options->title) ? (string)$options->title : '',
			'ntBrandDesc' => !empty($pluginOptions->ntBrandDesc) ? (string)$pluginOptions->ntBrandDesc : '',
			'assetsBase' => $pluginUrl . '/assets',
			'defaultImage' => !empty($pluginOptions->defaultImageUrl) ? (string)$pluginOptions->defaultImageUrl : ($pluginUrl . '/assets/poster.webp'),
			'cdnHtml2canvasUrl' => !empty($pluginOptions->cdnHtml2canvasUrl) ? (string)$pluginOptions->cdnHtml2canvasUrl : 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
			'cdnQrcodeUrl' => !empty($pluginOptions->cdnQrcodeUrl) ? (string)$pluginOptions->cdnQrcodeUrl : 'https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js',
			'localHtml2canvasUrl' => $pluginUrl . '/assets/vendor/html2canvas.min.js',
			'localQrcodeUrl' => $pluginUrl . '/assets/vendor/qrcode.min.js',
		];

		echo '<link rel="stylesheet" href="' . $cfg['assetsBase'] . '/teposter.css?v=9" />' . "\n";
		if (!empty($pluginOptions->customCss)) {
			echo '<style id="teposter-custom-css">' . $pluginOptions->customCss . '</style>' . "\n";
		}

		$qrCdn = htmlspecialchars($cfg['cdnQrcodeUrl']);
		$qrLocal = $cfg['localQrcodeUrl'];
		$h2cCdn = htmlspecialchars($cfg['cdnHtml2canvasUrl']);
		$h2cLocal = $cfg['localHtml2canvasUrl'];
		echo '<script src="' . $qrCdn . '" onerror="(function(){var s=document.createElement(\'script\');s.src=\'' . $qrLocal . '\';document.head.appendChild(s);})();"></script>' . "\n";
		echo '<script src="' . $h2cCdn . '" onerror="(function(){var s=document.createElement(\'script\');s.src=\'' . $h2cLocal . '\';document.head.appendChild(s);})();"></script>' . "\n";
		$bootstrapFallback = "(function(){function f(){if(typeof QRCode==='undefined'){var s=document.createElement('script');s.src='" . $qrLocal . "';document.head.appendChild(s);}if(typeof html2canvas==='undefined'){var s2=document.createElement('script');s2.src='" . $h2cLocal . "';document.head.appendChild(s2);}}if(document.readyState==='complete'){setTimeout(f,300);}else{window.addEventListener('load',function(){setTimeout(f,300);});}})();";
		echo '<script>' . $bootstrapFallback . '</script>' . "\n";

		echo '<script>window.TEPosterConfig = ' . json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script>' . "\n";
		echo '<script src="' . $cfg['assetsBase'] . '/teposter.js?v=8"></script>' . "\n";
	}
}


