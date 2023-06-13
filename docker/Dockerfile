FROM ruby:3.2.2
RUN mkdir -p /content
RUN apt-get update && bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
ADD entrypoint.sh /bin
CMD /bin/entrypoint.sh
EXPOSE 4000
EXPOSE 35729
