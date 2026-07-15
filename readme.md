## 插件信息

TEPoster：给 Typecho 文章生成分享海报

## 海报预览
![1](https://github.com/SurGarfield/TEPoster/blob/main/海报预览/1.png)

## 安装和接入主题

1. 下载并解压插件。

2. 确认目录名是 TEPoster。

3. 把整个目录上传到 Typecho 的 /usr/plugins/。

4. 进入后台“控制台 -> 插件”，启用 TEPoster。

5. 打开插件设置，选择图片来源和海报样式。

6. 在主题的文章模板里加入按钮调用代码。

调用代码只有一行：

```php

<?php TEPoster_Plugin::insertButton(); ?>

```

建议放在文章正文结束后的分享、版权或操作区域。



## PJAX 主题

大多数 PJAX 主题不需要额外处理。主题如果有自己的页面缓存或特殊切换流程，可以在 PJAX 完成后调用：

```javascript

if (window.TEPoster && window.TEPoster.rebind) {

  window.TEPoster.rebind();

}

```

无论是否使用 PJAX，都要确保主题输出 <?php $this->footer(); ?>。如果 PJAX 会清掉全局脚本或替换 footer，需要额外修改主题的加载流程。

## 依赖和预览

html2canvas 和 qrcode.js 默认从插件目录按需加载；本地文件加载失败后，会再尝试后台填写的 CDN 地址。



## 下载和反馈

- 项目地址：[SurGarfield/TEPoster](https://github.com/SurGarfield/TEPoster)

- 问题反馈：[轻论坛](https://litebbs.com/post/111)

用着顺手的话，仓库里点个 Star 就好。

