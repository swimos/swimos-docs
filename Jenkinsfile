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
                    sh 'apt-get install -y openjdk-17-jdk-headless'
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

        stage('config-s3-stage') {
            when { not { branch 'main' } }
            steps {
                script {
                    def redirectsJson = readJSON file: '_site/redirects.json'
                    def redirectsTrimmed = [:]
                    redirectsJson.each { redirect ->
                        redirectsTrimmed[redirect.key.substring(1)] = redirect.value
                    }

                    def s3ConfigYaml = readYaml(file: 's3_website.yml')
                    // Copy over the existing redirects if there are some defined in s3_website.yml
                    def existingRedirects = s3ConfigYaml['redirects']
                    if(null!= existingRedirects) {
                        existingRedirects.each { redirect ->
                            redirectsTrimmed[redirect.key] = redirect.value
                        }
                    }

                    s3ConfigYaml['s3_key_prefix'] = "${JOB_NAME}/${BUILD_NUMBER}"
                    s3ConfigYaml['s3_bucket'] = "nstream-developer-stg"
                    s3ConfigYaml['redirects'] = redirectsTrimmed
                    writeYaml(file: 's3_website.yml', overwrite: true, data: s3ConfigYaml)
                    archiveArtifacts artifacts: 's3_website.yml'
                }
            }
        }


        stage('deploy-staging') {
            when { not { branch 'main' } }
            steps {
                sh 'echo Deploying to staging'
                container('ruby') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        script {
                            sh "s3_website push"
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