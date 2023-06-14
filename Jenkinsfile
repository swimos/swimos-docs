pipeline {
    agent {
        kubernetes {
            cloud 'kubernetes'
            inheritFrom 'default'
            yaml '''
        apiVersion: v1
        kind: Pod
        metadata:
          labels:
            some-label: some-label-value
        spec:
          containers:
          - name: ruby
            image: ruby:3.2.2
            command:
            - cat
            tty: true
          - name: node
            image: node:20.3
            command:
            - cat
            tty: true          
        '''
        }
    }

    environment {
        JEKYLL_ENV = "${env.BRANCH = 'main' ? 'production' : 'development'} jekyll build"
    }

    stages {
        stage('prepare') {
            steps {
                container('ruby') {
                    sh 'apt-get update && bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"'
                    sh 'bundle install'
                    sh 'npm install'
                }
            }
        }
        stage('build') {
            steps {
                container('ruby') {
                    sh 'echo $JEKYLL_ENV'
                    sh 'bundle exec jekyll build'
                    archiveArtifacts artifacts: '_site/**/*', followSymlinks: false
                }
            }
        }
        stage('deploy-staging') {
            when { not { branch 'main' } }
        }
        stage('deploy-production') {
            when { branch 'main' }
        }
    }
}