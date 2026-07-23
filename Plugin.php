<?php
/**
 * 文章页生成海报，调用：TEPoster_Plugin::insertButton()
 * @package TEPoster
 * @author 森木志
 * @version 1.2.0
 * @link https://oxxx.cn
 *
 */
if (!defined('__TYPECHO_ROOT_DIR__')) {
	exit;
}
class TEPoster_Plugin implements Typecho_Plugin_Interface
{
	/**
	 * 启用插件
	 */
	public static function activate()
	{
		Typecho_Plugin::factory('Widget_Archive')->footer = ['TEPoster_Plugin', 'footer'];
		Helper::addAction('teposter-image', 'TEPoster_Action');
		return _t('TEPoster 插件已启用');
	}

	/**
	 * 禁用插件
	 */
	public static function deactivate()
	{
		Helper::removeAction('teposter-image');
		return _t('TEPoster 插件已禁用');
	}

	/**
	 * 插件设置
	 */
	public static function config(Typecho_Widget_Helper_Form $form)
	{
		$logoUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'logoUrl', null, '', _t('品牌图片地址'), _t('默认、NiceTheme 和网易云版式使用；留空或图片无法读取时显示网站标题。建议使用本站图片。')
		);

		$buttonClass = new Typecho_Widget_Helper_Form_Element_Text(
			'buttonClass', null, 'teposter-btn', _t('按钮样式类名'), _t('用于套用主题现有的按钮样式。OneBlog 主题已深度适配，无需填写类名。')
		);

		$posterWidth = new Typecho_Widget_Helper_Form_Element_Text(
			'posterWidth', null, '400', _t('海报宽度'), _t('单位为像素，建议填写 360-600；默认 400。')
		);

		$imageSource = new Typecho_Widget_Helper_Form_Element_Radio(
			'imageSource',
			[
				'default' => _t('插件默认图'),
				'thumb' => _t('文章封面'),
				'unsplash' => _t('Unsplash 随机图')
			],
			'default',
			_t('选择封面来源'),
			_t('选择“文章封面”时，会依次读取自定义字段、主题封面、正文首图和页面分享图；都不可用时显示默认图。')
		);

		$defaultImageUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'defaultImageUrl', null, '', _t('默认图片地址'), _t('填写完整图片地址；留空则使用插件内置图片。远程图片跨域失败时会尝试本站代理，服务器需启用 cURL。')
		);

		$customCoverField = new Typecho_Widget_Helper_Form_Element_Text(
			'customCoverField', null, 'thumb', _t('封面字段名'), _t('选择“文章封面”时优先读取该自定义字段，例如 thumb。')
		);

		$unsplashAccessKey = new Typecho_Widget_Helper_Form_Element_Text(
			'unsplashAccessKey', null, '', _t('Unsplash 访问密钥'), _t('在 Unsplash 开发者平台创建应用后填写。')
		);

		$unsplashKeywords = new Typecho_Widget_Helper_Form_Element_Text(
			'unsplashKeywords', null, '', _t('Unsplash 图片关键词'), _t('例如 nature 或 city；留空则不限制图片主题。')
		);

		$posterStyle = new Typecho_Widget_Helper_Form_Element_Radio(
			'posterStyle',
			[
				'default' => _t('默认'),
				'nicetheme' => _t('NiceTheme'),
				'netease' => _t('网易云'),
				'minimal' => _t('深色卡片'),
				// 旧值仅用于读取已有配置，后台脚本会将其迁移到 nicetheme。
				'ninetheme' => _t('NiceTheme')
			],
			'default',
			_t('海报版式'),
			_t('切换版式后，下方只显示当前版式会用到的专属选项。')
		);

		$qrSizeDefault = new Typecho_Widget_Helper_Form_Element_Text(
			'qrSizeDefault', null, '130', _t('二维码尺寸'), _t('单位为像素，默认 130。')
		);

		$qrSizeNinetheme = new Typecho_Widget_Helper_Form_Element_Text(
			'qrSizeNinetheme', null, '75', _t('二维码尺寸'), _t('单位为像素，默认 75。')
		);

		$ntBrandDesc = new Typecho_Widget_Helper_Form_Element_Text(
			'ntBrandDesc', null, '', _t('底部说明'), _t('显示在网站名称下方；留空则不显示。')
		);

		$minimalIdentity = new Typecho_Widget_Helper_Form_Element_Radio(
			'minimalIdentity',
			[
				'site' => _t('网站信息'),
				'author' => _t('文章作者')
			],
			'site',
			_t('底部信息'),
			_t('选择显示圆形网站图标和网站名，或圆形作者头像和作者名。')
		);

		$assetSource = new Typecho_Widget_Helper_Form_Element_Radio(
			'assetSource',
			[
				'local' => _t('插件内置文件（推荐）'),
				'cdn' => _t('外部加速地址')
			],
			'local',
			_t('脚本来源'),
			_t('设置海报生成脚本和二维码脚本从哪里加载。')
		);

		$cdnHtml2canvasUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'cdnHtml2canvasUrl', null, 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', _t('海报生成脚本地址'), _t('仅在脚本来源选择“外部加速地址”时使用。')
		);

		$cdnQrcodeUrl = new Typecho_Widget_Helper_Form_Element_Text(
			'cdnQrcodeUrl', null, 'https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js', _t('二维码脚本地址'), _t('仅在脚本来源选择“外部加速地址”时使用。')
		);

		$customCss = new Typecho_Widget_Helper_Form_Element_Textarea(
			'customCss', null, '', _t('自定义样式'), _t('填写需要附加到海报或按钮的样式代码。')
		);

		$posterWidth
			->addRule('isInteger', _t('海报宽度必须填写整数。'))
			->addRule([__CLASS__, 'validateIntegerRange'], _t('海报宽度应在 240 到 1200 像素之间。'), 240, 1200);
		$qrSizeDefault
			->addRule('isInteger', _t('二维码尺寸必须填写整数。'))
			->addRule([__CLASS__, 'validateIntegerRange'], _t('二维码尺寸应在 40 到 400 像素之间。'), 40, 400);
		$qrSizeNinetheme
			->addRule('isInteger', _t('二维码尺寸必须填写整数。'))
			->addRule([__CLASS__, 'validateIntegerRange'], _t('二维码尺寸应在 30 到 240 像素之间。'), 30, 240);

		try {
			$posterWidth->setInputsAttribute('min', '240');
			$posterWidth->setInputsAttribute('max', '1200');
			$posterWidth->setInputsAttribute('step', '1');
			$qrSizeDefault->setInputsAttribute('min', '40');
			$qrSizeDefault->setInputsAttribute('max', '400');
			$qrSizeDefault->setInputsAttribute('step', '1');
			$qrSizeNinetheme->setInputsAttribute('min', '30');
			$qrSizeNinetheme->setInputsAttribute('max', '240');
			$qrSizeNinetheme->setInputsAttribute('step', '1');
			$logoUrl->container->setAttribute('data-teposter-show-when', 'style:default style:nicetheme style:netease');
			$qrSizeDefault->container->setAttribute('data-teposter-show-when', 'style:default');
			$qrSizeNinetheme->container->setAttribute('data-teposter-show-when', 'style:nicetheme');
			$ntBrandDesc->container->setAttribute('data-teposter-show-when', 'style:nicetheme');
			$minimalIdentity->container->setAttribute('data-teposter-show-when', 'style:minimal');
			$defaultImageUrl->container->setAttribute('data-teposter-show-when', 'source:default');
			$customCoverField->container->setAttribute('data-teposter-show-when', 'source:thumb');
			$unsplashAccessKey->container->setAttribute('data-teposter-show-when', 'source:unsplash');
			$unsplashKeywords->container->setAttribute('data-teposter-show-when', 'source:unsplash');
			$cdnHtml2canvasUrl->container->setAttribute('data-teposter-show-when', 'asset:cdn');
			$cdnQrcodeUrl->container->setAttribute('data-teposter-show-when', 'asset:cdn');
			foreach ([$posterStyle, $posterWidth, $logoUrl, $imageSource, $defaultImageUrl, $customCoverField, $unsplashAccessKey, $unsplashKeywords, $qrSizeDefault, $qrSizeNinetheme, $ntBrandDesc, $minimalIdentity] as $generalField) {
				$generalField->container->setAttribute('data-teposter-section', 'general');
			}
			foreach ([$buttonClass, $assetSource, $cdnHtml2canvasUrl, $cdnQrcodeUrl, $customCss] as $advancedField) {
				$advancedField->container->setAttribute('data-teposter-section', 'advanced');
			}
			foreach ([$buttonClass, $customCoverField, $unsplashAccessKey] as $mediumField) {
				$mediumField->container->setAttribute('data-teposter-width', 'medium');
			}
			foreach ([$posterWidth, $qrSizeDefault, $qrSizeNinetheme] as $compactField) {
				$compactField->container->setAttribute('data-teposter-width', 'compact');
			}
		} catch (\Throwable $e) {}

		$form->setAttribute('class', 'teposter-admin-form');

		self::addConfigTabs($form);
		$form->addInput($posterStyle);
		$form->addInput($logoUrl);
		$form->addInput($imageSource);
		$form->addInput($defaultImageUrl);
		$form->addInput($unsplashAccessKey);
		$form->addInput($unsplashKeywords);
		$form->addInput($posterWidth);
		$form->addInput($qrSizeDefault);
		$form->addInput($qrSizeNinetheme);
		$form->addInput($customCoverField);
		$form->addInput($ntBrandDesc);
		$form->addInput($minimalIdentity);

		$form->addInput($buttonClass);
		$form->addInput($assetSource);
		$form->addInput($cdnHtml2canvasUrl);
		$form->addInput($cdnQrcodeUrl);
		$form->addInput($customCss);

		echo <<<'TEPOSTER_ADMIN'
<style>
.teposter-admin-form { max-width: 760px; }
.teposter-admin-tabs { position: sticky; top: 0; z-index: 10; display: flex; gap: 24px; margin: 0 0 26px; border-bottom: 1px solid #dfe3e6; }
.teposter-admin-tab { position: relative; min-width: 72px; padding: 13px 2px 11px; border: 0; background: transparent; color: #69727a; cursor: pointer; font-size: 14px; font-weight: 600; line-height: 1.4; text-align: center; }
.teposter-admin-tab::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: transparent; content: ''; }
.teposter-admin-tab.is-active { color: #286d8b; }
.teposter-admin-tab.is-active::after { background: #286d8b; }
.teposter-admin-tab:focus-visible { outline: 2px solid #286d8b; outline-offset: -2px; }
.teposter-admin-form > ul.typecho-option { margin-bottom: 22px; }
.teposter-admin-form > ul.typecho-option .typecho-label { margin-bottom: 8px; color: #33383d; font-size: 14px; font-weight: 600; line-height: 1.5; }
.teposter-admin-form > ul.typecho-option .description { max-width: 640px; margin-top: 7px; color: #7b838a; line-height: 1.65; }
.teposter-admin-form > ul.typecho-option > li > span { display: inline-flex; align-items: center; min-height: 34px; max-width: 100%; margin: 0 8px 8px 0; padding: 0 10px; border: 1px solid #d9dee2; border-radius: 4px; background: #fff; box-sizing: border-box; cursor: pointer; user-select: none; white-space: normal; }
.teposter-admin-form > ul.typecho-option > li > span:has(input:checked) { border-color: #6d96aa; background: #f4f8fa; }
.teposter-admin-form > ul.typecho-option > li > span:has(input[name="posterStyle"][value="ninetheme"]) { display: none; }
.teposter-admin-form > ul.typecho-option > li > span label { align-self: stretch; display: flex; flex: 1; align-items: center; margin-left: 6px; cursor: pointer; overflow-wrap: anywhere; }
.teposter-admin-form input.text,
.teposter-admin-form textarea { width: 100%; max-width: 100%; box-sizing: border-box; }
.teposter-admin-form li[data-teposter-width="medium"] input.text { max-width: 420px; }
.teposter-admin-form li[data-teposter-width="compact"] input.text { max-width: 180px; }
.teposter-admin-compact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 180px)); gap: 18px 24px; margin-bottom: 22px; }
.teposter-admin-compact-grid.is-single { grid-template-columns: minmax(0, 180px); }
.teposter-admin-compact-grid > ul.typecho-option { min-width: 0; margin: 0; }
.teposter-admin-compact-grid > ul.typecho-option input.text { width: 100%; max-width: none; }
.teposter-admin-form textarea { min-height: 120px; resize: vertical; }
@media (max-width: 767px) {
	.teposter-admin-tabs { gap: 18px; margin-bottom: 22px; }
  .teposter-admin-form > ul.typecho-option > li > span { display: flex; width: 100%; margin-right: 0; }
  .teposter-admin-form li[data-teposter-width] input.text { max-width: 100%; }
	.teposter-admin-compact-grid,
	.teposter-admin-compact-grid.is-single { grid-template-columns: 1fr 1fr; gap: 14px; }
}
@media (max-width: 480px) {
	.teposter-admin-compact-grid,
	.teposter-admin-compact-grid.is-single { grid-template-columns: 1fr; }
}
</style>
<script>
(function () {
  function initTEPosterAdmin() {
    var form = document.querySelector('form.teposter-admin-form');
    if (!form || form.getAttribute('data-teposter-ready') === '1') return;
    form.setAttribute('data-teposter-ready', '1');

    var legacyStyle = form.querySelector('input[name="posterStyle"][value="ninetheme"]');
    var nicethemeStyle = form.querySelector('input[name="posterStyle"][value="nicetheme"]');
    if (legacyStyle) {
      if (legacyStyle.checked && nicethemeStyle) nicethemeStyle.checked = true;
      legacyStyle.disabled = true;
      var legacyItem = legacyStyle.parentNode;
      if (legacyItem) legacyItem.style.display = 'none';
    }

		var activeSection = 'general';
		var tabButtons = form.querySelectorAll('[data-teposter-tab]');
		var compactGrids = [];

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
			arrangeCompactGrids();
			var fields = form.querySelectorAll('[data-teposter-section]');
			Array.prototype.forEach.call(fields, function (field) {
				var visible = field.getAttribute('data-teposter-section') === activeSection && matchesRule(field);
				var row = field.closest ? field.closest('ul.typecho-option') : field.parentNode;
				if (row) row.style.display = visible ? '' : 'none';
			});
			Array.prototype.forEach.call(compactGrids, function (grid) {
				var visibleRows = grid.querySelectorAll('ul.typecho-option:not([style*="display: none"])');
				grid.classList.toggle('is-single', visibleRows.length < 2);
				grid.style.display = activeSection === 'general' && visibleRows.length ? 'grid' : 'none';
			});
		}

		function fieldRow(name) {
			var input = form.querySelector('[name="' + name + '"]');
			return input && input.closest ? input.closest('ul.typecho-option') : null;
		}

		function arrangeCompactGrids() {
			if (compactGrids.length !== 2) return;
			var style = currentValue('posterStyle', 'default');
			var coverRow = fieldRow('customCoverField');
			var targetGrid = style === 'default' || style === 'nicetheme' ? compactGrids[1] : compactGrids[0];
			if (coverRow && targetGrid) targetGrid.appendChild(coverRow);
			if (targetGrid === compactGrids[1]) {
				var descRow = fieldRow('ntBrandDesc');
				if (descRow) targetGrid.appendChild(descRow);
			}
		}

		function buildCompactGrids() {
			var widthRow = fieldRow('posterWidth');
			var coverRow = fieldRow('customCoverField');
			if (!widthRow || !coverRow || !widthRow.parentNode || !coverRow.parentNode) return;

			var primaryGrid = document.createElement('div');
			var secondaryGrid = document.createElement('div');
			primaryGrid.className = 'teposter-admin-compact-grid';
			secondaryGrid.className = 'teposter-admin-compact-grid';
			widthRow.parentNode.insertBefore(primaryGrid, widthRow);
			coverRow.parentNode.insertBefore(secondaryGrid, coverRow);
			compactGrids = [primaryGrid, secondaryGrid];

			['posterWidth', 'qrSizeDefault', 'qrSizeNinetheme'].forEach(function (name) {
				var row = fieldRow(name);
				if (row) primaryGrid.appendChild(row);
			});
			secondaryGrid.appendChild(coverRow);
			var descRow = fieldRow('ntBrandDesc');
			if (descRow) secondaryGrid.appendChild(descRow);
		}

		Array.prototype.forEach.call(tabButtons, function (button) {
			button.addEventListener('click', function () {
				activeSection = button.getAttribute('data-teposter-tab') || 'general';
				Array.prototype.forEach.call(tabButtons, function (item) {
					var selected = item === button;
					item.classList.toggle('is-active', selected);
					item.setAttribute('aria-selected', selected ? 'true' : 'false');
					item.setAttribute('tabindex', selected ? '0' : '-1');
				});
				refreshFields();
			});
		});

    form.addEventListener('change', function (event) {
      var name = event.target && event.target.name;
      if (name === 'posterStyle' || name === 'imageSource' || name === 'assetSource') {
        refreshFields();
      }
    });

    form.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('input[type="radio"], label')) return;
      var option = target.closest('li > span');
      if (!option || !form.contains(option)) return;
      var radio = option.querySelector('input[type="radio"]');
      if (!radio || radio.disabled) return;
      radio.focus();
      radio.click();
    });

		buildCompactGrids();
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

	public static function validateIntegerRange($value, $min, $max)
	{
		return filter_var($value, FILTER_VALIDATE_INT) !== false
			&& (int)$value >= (int)$min
			&& (int)$value <= (int)$max;
	}

	private static function addConfigTabs(Typecho_Widget_Helper_Form $form)
	{
		$tabs = new Typecho_Widget_Helper_Layout('div', [
			'class' => 'teposter-admin-tabs',
			'role' => 'tablist',
			'aria-label' => _t('插件设置')
		]);
		$generalTab = new Typecho_Widget_Helper_Layout('button', [
			'type' => 'button', 'class' => 'teposter-admin-tab is-active', 'role' => 'tab',
			'data-teposter-tab' => 'general', 'aria-selected' => 'true', 'tabindex' => '0'
		]);
		$generalTab->html(_t('普通设置'));
		$advancedTab = new Typecho_Widget_Helper_Layout('button', [
			'type' => 'button', 'class' => 'teposter-admin-tab', 'role' => 'tab',
			'data-teposter-tab' => 'advanced', 'aria-selected' => 'false', 'tabindex' => '-1'
		]);
		$advancedTab->html(_t('高级设置'));
		$tabs->addItem($generalTab);
		$tabs->addItem($advancedTab);
		$form->addItem($tabs);
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

	private static function buildImageProxyMap(array $urls, $options)
	{
		$map = [];
		$secret = isset($options->secret) ? (string)$options->secret : '';
		$siteIndex = isset($options->index) ? rtrim((string)$options->index, '/') : '';
		if ($secret === '' || $siteIndex === '') {
			return $map;
		}

		$actionUrl = Typecho_Common::url('/action/teposter-image', $siteIndex);
		$actionPath = parse_url($actionUrl, PHP_URL_PATH);
		if (!is_string($actionPath) || $actionPath === '') {
			$actionPath = '/action/teposter-image';
		}
		if ($actionPath[0] !== '/') {
			$actionPath = '/' . $actionPath;
		}

		foreach ($urls as $url) {
			$url = html_entity_decode(trim((string)$url), ENT_QUOTES, 'UTF-8');
			$parts = $url !== '' ? parse_url($url) : false;
			if (!$parts || empty($parts['scheme']) || empty($parts['host']) || !in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
				continue;
			}
			if (isset($map[$url])) {
				continue;
			}
			$token = hash_hmac('sha256', $url, $secret);
			$map[$url] = $actionPath . '?url=' . rawurlencode($url) . '&token=' . rawurlencode($token);
		}

		return $map;
	}

	public static function footer($archive = null)
	{
		$widget = ($archive instanceof Widget_Archive) ? $archive : Typecho_Widget::widget('Widget_Archive');

		$options = Helper::options();
		$pluginUrl = rtrim($options->pluginUrl, '/') . '/TEPoster';
		$pluginOptions = $options->plugin('TEPoster');

		$postContext = self::getPostContext($widget, $pluginOptions);

		$assetSource = !empty($pluginOptions->assetSource) ? (string)$pluginOptions->assetSource : 'local';
		$cdnHtml2canvasUrl = !empty($pluginOptions->cdnHtml2canvasUrl) ? (string)$pluginOptions->cdnHtml2canvasUrl : 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
		$cdnQrcodeUrl = !empty($pluginOptions->cdnQrcodeUrl) ? (string)$pluginOptions->cdnQrcodeUrl : 'https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js';
		$localHtml2canvasUrl = $pluginUrl . '/assets/vendor/html2canvas.min.js?v=1.4.1';
		$localQrcodeUrl = $pluginUrl . '/assets/vendor/qrcode.min.js?v=0.0.2';

		$posterStyle = !empty($pluginOptions->posterStyle) ? (string)$pluginOptions->posterStyle : 'default';
		if ($posterStyle === 'ninetheme') {
			$posterStyle = 'nicetheme';
		}
		$defaultImage = !empty($pluginOptions->defaultImageUrl) ? (string)$pluginOptions->defaultImageUrl : ($pluginUrl . '/assets/poster.webp');
		$logoUrl = !empty($pluginOptions->logoUrl) ? (string)$pluginOptions->logoUrl : '';
		$imageProxyMap = self::buildImageProxyMap([$postContext['cover'], $defaultImage, $logoUrl], $options);

		$cfg = [
			'posterWidth' => isset($pluginOptions->posterWidth) ? intval($pluginOptions->posterWidth) : 400,
			// 兼容旧版 qrSize：如存在则作为两者的后备
			'qrSizeDefault' => isset($pluginOptions->qrSizeDefault) ? intval($pluginOptions->qrSizeDefault) : (isset($pluginOptions->qrSize) ? intval($pluginOptions->qrSize) : 130),
			'qrSizeNinetheme' => isset($pluginOptions->qrSizeNinetheme) ? intval($pluginOptions->qrSizeNinetheme) : (isset($pluginOptions->qrSize) ? intval($pluginOptions->qrSize) : 75),
			'logoUrl' => $logoUrl,
			'unsplashKeywords' => !empty($pluginOptions->unsplashKeywords) ? (string)$pluginOptions->unsplashKeywords : '',
			'unsplashAccessKey' => !empty($pluginOptions->unsplashAccessKey) ? (string)$pluginOptions->unsplashAccessKey : '',
			'postCustomCover' => $postContext['cover'],
			'postDateISO' => $postContext['date'],
			'postAuthor' => $postContext['author'],
			'postAuthorAvatar' => $postContext['authorAvatar'],
			'imageSource' => !empty($pluginOptions->imageSource) ? (string)$pluginOptions->imageSource : 'default',
			'posterStyle' => $posterStyle,
			'minimalIdentity' => !empty($pluginOptions->minimalIdentity) ? (string)$pluginOptions->minimalIdentity : 'site',
			'siteTitle' => isset($options->title) ? (string)$options->title : '',
			'ntBrandDesc' => !empty($pluginOptions->ntBrandDesc) ? (string)$pluginOptions->ntBrandDesc : '',
			'imageProxyMap' => $imageProxyMap,
			'assetsBase' => $pluginUrl . '/assets',
			'defaultImage' => $defaultImage,
			'cdnHtml2canvasUrl' => $cdnHtml2canvasUrl,
			'cdnQrcodeUrl' => $cdnQrcodeUrl,
			'localHtml2canvasUrl' => $localHtml2canvasUrl,
			'localQrcodeUrl' => $localQrcodeUrl,
			'assetSource' => $assetSource,
		];

		echo '<link rel="stylesheet" href="' . $cfg['assetsBase'] . '/teposter.css?v=25" />' . "\n";
		if (!empty($pluginOptions->customCss)) {
			$customCss = preg_replace('/<\\/style/i', '<\\/style', (string)$pluginOptions->customCss);
			echo '<style id="teposter-custom-css">' . $customCss . '</style>' . "\n";
		}

		echo '<script>window.TEPosterConfig = ' . json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script>' . "\n";
		echo '<script src="' . $cfg['assetsBase'] . '/teposter.js?v=33"></script>' . "\n";
	}
}
