set -x

cd /content

bundle install
npm install
bundle exec jekyll serve --host=0.0.0.0