# SwimOS Developer Documentation

## Developing Locally

Checkout repo

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
