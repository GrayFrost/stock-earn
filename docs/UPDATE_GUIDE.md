# Stock Earn 应用更新指南

本文说明修改代码并运行 `npm run make` 后，如何使用最新版本的 Stock Earn 美股账本。

## 先区分两种构建产物

运行 `npm run make` 后，`out/` 目录中主要有两类文件。

### 1. 安装版（推荐）

安装包位于：

```text
out/make/squirrel.windows/x64/Stock Earn 美股账本-<版本号> Setup.exe
```

例如：

```text
out/make/squirrel.windows/x64/Stock Earn 美股账本-0.1.1 Setup.exe
```

使用安装版后，日常从桌面或开始菜单的快捷方式启动应用。以后更新时，只需要关闭旧应用并运行新的 `Setup.exe`，不需要手动删除或替换安装目录。

### 2. 免安装应用目录

免安装版位于：

```text
out/Stock Earn 美股账本-win32-x64/
```

这个目录中的 `.exe`、`.dll`、`resources` 等文件共同组成完整应用，不能只复制其中的 `.exe`。

如果使用免安装版，更新时需要用新生成的整个目录替换旧目录。为了减少操作失误，建议平时使用安装版。

## 推荐的更新流程

### 第一步：完成代码修改并测试

开发过程中可以运行：

```powershell
npm start
```

确认新功能或修复可以正常工作后，再制作安装包。

### 第二步：提升版本号

每次准备生成一个新版本时，运行：

```powershell
npm version patch --no-git-tag-version
```

例如，版本号会从 `0.1.0` 变为 `0.1.1`。

版本号由 `package.json` 管理。不要长期使用同一个版本号重复打包，否则安装程序可能无法正确区分新旧版本。

版本号含义：

- `patch`：小修复，例如 `0.1.0` → `0.1.1`
- `minor`：新增功能，例如 `0.1.1` → `0.2.0`
- `major`：存在重大或不兼容变化，例如 `0.2.0` → `1.0.0`

对应命令分别为：

```powershell
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

每次只需要选择其中一个命令。

### 第三步：生成新版安装包

运行：

```powershell
npm run make
```

完成后，在下面的目录中找到带有新版本号的安装包：

```text
out/make/squirrel.windows/x64/
```

### 第四步：安装新版应用

1. 完全退出正在运行的旧版 Stock Earn。
2. 双击新生成的 `Stock Earn 美股账本-<版本号> Setup.exe`。
3. 等待安装完成。
4. 继续使用原来的桌面或开始菜单快捷方式启动应用。

不需要手动查找、删除或覆盖 Windows 中的旧安装目录。

## 账本数据会不会丢失

正常更新不会删除账本数据。应用数据与程序安装文件分开保存，数据目录为：

```text
%APPDATA%\Stock Earn 美股账本\
```

通常对应：

```text
C:\Users\<用户名>\AppData\Roaming\Stock Earn 美股账本\
```

删除项目里的 `out/` 目录、重新打包或安装新版本，都不会直接删除这个数据目录。

不过，在进行数据库结构调整或其他重大更新前，仍建议先进入应用的“设置”页面，使用“导出备份”保存一份账本备份。

## `out/` 目录可以删除吗

可以。`out/` 只是本地构建产物，不是账本数据目录。

删除后再次运行：

```powershell
npm run make
```

Electron Forge 会重新生成构建产物。

## 最简操作清单

以后每次发布更新，只需执行：

```powershell
npm version patch --no-git-tag-version
npm run make
```

然后：

1. 关闭旧版应用。
2. 运行 `out/make/squirrel.windows/x64/` 中最新版本的 `Setup.exe`。
3. 从原来的快捷方式打开应用。

当前项目尚未配置在线自动更新，因此每个新版本都需要手动运行新版安装包。
