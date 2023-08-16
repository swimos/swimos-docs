---
title: Contributing Guide
layout: page
description: "Install the SwimOS docs site locally and contribute to the documentation project."
---

This guide explains how the SwimOS docs site is set up and how contributions get merged.

## Contribute to Documentation

Most documents on this site are located in the `src` folder of the `swimos-docs` repository and are organized using the [Diátaxis Framework]({% link _meta/diataxis.md %}). You can add new content or update existing content in this folder.

## Contribute to Documentation Website

Changes to templates or fixes to the docs site are also welcome! Please see the [Styles]({% link _meta/styles.md %}) guide to learn how website assets are structured and managed.

## Contribution Process

### Jekyll Installation

[Fork](https://github.com/swimos/swimos-docs/fork) the repository on [GitHub](https://github.com/swimos/swimos-docs) to get started.

1. Clone your fork of the repository.
2. Change into the `swimos-docs` directory.

```bash
git clone git@github.com:yourname/swimos-docs.git
cd swimos-docs`
```

#### macOS

{:.no_toc}
##### Prerequisites

Install `rbenv`, add it to $PATH, and install the latest version of Ruby:

```bash
brew install rbenv
echo 'eval "$(rbenv init -)"' >> ~/.zshrc
rbenv install 3.2.2
rbenv local 3.2.2
```

{:.no_toc}
##### Install Jekyll & Dependencies

```bash
gem install jekyll bundler
```

{:.no_toc}
##### Install JS dependencies

```bash
npm install
```

{:.no_toc}
##### Launch Jekyll

```bash
bundle exec jekyll serve --livereload
```

**Note:** On some Ruby versions this command may fail. Add `webrick` to your dependencies and try again:

```bash
bundle add webrick
```

View the site at [http://localhost:4000/](http://localhost:4000/)

#### Windows

We haven't set this up on Windows yet! If you run into issues getting this site up and running on Windows, please open an [issue](https://github.com/swimos/swimos-docs/issues/new) so we can look into it. If you manage to get it working, we'd welcome a PR to this doc with installation steps. :)

### Open a Pull Request

Once you've made changes to content or the site, open a [Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) to get your changes reviewed and merged.

1. PR Naming Conventions

    We recommend, but do not require, that PR titles follow a `type: description` format . `type` refers to the part of the code base that the PR is touching

    - `docs`: Updates to documentation. Most PRs will probably fall under this type.
    - `chore`: Updates to build scripts/tasks, no user-facing code changes.
    - `feat`: Used for new user-facing features.
    - `revert`: Used when reverting a previous commit.
    - `fix`: Used for bug fixes.
    - `style`: Updates to the look and feel of the site.

    The `description` gives a short overview of what the PR is changing. Keep these short and simple.

    An example PR title might look like: `docs: Add new tutorial that covers real time dashboard widgets`. A PR that follows these conventions can be found [here.](https://github.com/swimos/swimos-docs/pull/81).

2. Pull Request Drafts

    If you'd like to get early feedback on your pull request, you can open it and [mark it as a draft](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request#converting-a-pull-request-to-a-draft).

    Drafts are useful for when you want to propose a change but need feedback in order to complete the change set.

3. Pull Request Reviews

    If your draft is ready for review, you can [mark it as ready for review](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request#marking-a-pull-request-as-ready-for-review) to get feedback from the SwimOS team.

    Assign `@afolson` as a reviewer or tag `@afolson` in the comments to start the review process.

That's it! Thank you for your interest in contributing to the SwimOS docs.
