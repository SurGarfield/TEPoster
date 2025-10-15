## TEPoster - Typecho 文章海报生成插件
为 Typecho 文章页提供一键海报生成功能

### 使用方式
1. 后台启用插件，在文章模板中合适位置调用：`<?php TEPoster_Plugin::insertButton(); ?>`
2. 在插件设置中按需选择图片来源、海报样式，并填写相关参数
3. 打开文章页，点击“生成海报”，在弹出的预览中下载图片

### 适配说明
- 标题与摘要会优先从页面正文容器中解析，已内置常见主题选择器（含 OneBlog 的 `#post_content/.post_content`）
- 若页面含 `og:title`/`twitter:title` 也会作为回退使用

### 依赖
- html2canvas（截图转图片）
- qrcode.js（生成二维码）
> 插件默认使用 CDN，加载失败会自动回退到本地文件
