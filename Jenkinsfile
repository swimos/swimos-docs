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
          - name: aws-cli
            image: amazon/aws-cli:2.11.17
            command:
            - cat
            tty: true      
        '''
        }
    }

    environment {
        JEKYLL_ENV = "${env.BRANCH_NAME == 'main' ? 'production' : 'development'} jekyll build"
    }

    options {
        sidebarLinks([
                [displayName: 'Jekyll Output', iconFileName: '', urlName: "http://nstream-developer-stg.s3-website.us-west-1.amazonaws.com/${JOB_NAME}/${BUILD_NUMBER}"]
        ])
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
        stage('modify-config' ) {
            when { not { branch 'main' } }
            steps {
                script {
                    def configYaml = readYaml(file: '_config.yml')
                    configYaml['baseurl'] = "/${JOB_NAME}/${BUILD_NUMBER}"
                    configYaml['url'] = "http://nstream-developer-stg.s3-website.us-west-1.amazonaws.com"
                    writeYaml(file: '_config.yml', overwrite: true, data: configYaml)
                    archiveArtifacts artifacts: '_config.yml'
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
            steps {
                sh 'echo Deploying to staging'
                container('aws-cli') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        script {
                            sh "aws s3 sync --delete --size-only _site/ s3://nstream-developer-stg/${JOB_NAME}/${BUILD_NUMBER}/"
                            sh "touch zerobytefile"
                            def redirects = readJSON file: '_site/redirects.json'

                            redirects.each { redirect  ->
                                sh "aws s3 cp --dryrun --website-redirect '${redirect.value}' zerobytefile 's3://nstream-developer-stg/${JOB_NAME}/${BUILD_NUMBER}/${redirect.key}'"
                            }
                        }
                    }
                }
            }
        }
        stage('deploy-production') {
            when { branch 'main' }
            steps {
                sh 'echo Deploying to production'
                container('aws-cli') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        script {
                            sh "aws s3 sync --delete _site/ s3://nstream-developer-prd/www.swimos.org/"
                        }
                    }
                }
            }
        }
        stage('invalidate-cdn') {
            when { branch 'main' }
            steps {
                container('aws-cli') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        withCredentials([string(credentialsId: 'cloudfront-distribution-id-static-swimos', variable: 'CLOUDFRONT_DISTRIBUTION_ID')]) {
                            script {
                                sh "aws cloudfront create-invalidation --distribution-id '$CLOUDFRONT_DISTRIBUTION_ID' --paths '/*'"
                            }
                        }
                    }
                }
            }
        }
    }
}