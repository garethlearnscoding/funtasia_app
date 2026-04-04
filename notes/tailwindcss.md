# Project Setup Guide

If you are cloning this project on a brand new computer, you need to pull down the project packages before you can correctly compile the CSS styling.

Here are the step-by-step instructions:

## 1. Install Node Dependencies

First, download and install the exact versions of Tailwind CSS and its custom plugins locked in the `package-lock.json` by running:

```bash
npm install
```

This will automatically create a local `node_modules` folder on your machine containing the necessary compilation tools.

## 2. Compile Tailwind CSS (Development Mode)

Whenever you are actively working on editing the project's HTML code or writing custom CSS styles into `css/input.css`, run the Tailwind watcher in your terminal:

```bash
npm run watch:css
```

This command keeps your terminal running in the background. It will automatically detect any edits, compile the Tailwind rules, and inject them into `#css/output.css` on the fly. 

## 3. Build Tailwind CSS (Production Release)

If you only need to run a flawless final compilation of your customized classes without leaving a lingering watcher task open, simply trigger the build command instead:

```bash
npm run build:css
```

---
*Note: Your `node_modules` folder should remain completely untracked by Git, as defined locally via `.gitignore`.*
