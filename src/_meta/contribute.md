---
title: Contributing Guide
layout: page
description: "Install the SwimOS docs site locally and contribute to the documentation project."
---

## Installation

Checkout repo

[Fork](https://github.com/swimos/swimos-docs/fork) the repository on [GitHub](https://github.com/swimos/swimos-docs) to get started.

1. Clone your fork of the repository.
2. Change into the `swimos-docs` directory.

```bash
git clone git@github.com:yourname/swimos-docs.git
cd swimos-docs`
```

### macOS

#### Prerequisites

Install `rbenv`, add it to $PATH, and install the latest version of Ruby:

```bash
brew install rbenv
echo 'eval "$(rbenv init -)"' >> ~/.zshrc
rbenv install 3.2.2
rbenv local 3.2.2
```

#### Install Jekyll & Dependencies

```bash
gem install jekyll bundler
```

#### Install JS dependencies

```bash
npm install
```

#### Launch Jekyll

```bash
bundle exec jekyll serve --livereload
```

**Note:** On some Ruby versions this command may fail. Add `webrick` to your dependencies and try again:

```bash
bundle add webrick
```

View the site at [http://localhost:4000/](http://localhost:4000/)

## Making Changes

### Changes to Templates

Please review the documentation in the [Meta section]({% link _meta/index.md %}) to learn about how this site is structured and styled.

### Adding New Documents

This site uses the [Diátaxis Framework]({% link _meta/diataxis.md %}) framework to structure documentation.

## Open a Pull Request

