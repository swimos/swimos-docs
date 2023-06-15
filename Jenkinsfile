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
                [displayName: 'Jekyll Output', iconFileName: '', urlName: "https://nstream-developer-stg.s3.us-west-1.amazonaws.com/${JOB_NAME}/${BUILD_NUMBER}/index.html"]
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
                            sh "aws s3 sync _site/ s3://nstream-developer-stg/${JOB_NAME}/${BUILD_NUMBER}/"
                        }
                    }
                }
            }
        }
        stage('deploy-production') {
            when { not {branch 'main' }}
            steps {
                sh 'echo Deploying to production'
                container('aws-cli') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        script {
                            sh "aws s3 sync _site/ s3://nstream-developer-prd/${lower(JOB_NAME)}/"
                        }
                    }
                }
            }
        }
        stage('invalidate cdn') {
            when { not {branch 'main' }}
            steps {
                container('aws-cli') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        withCredentials([string(credentialsId: 'cloudfront-distribution-id-static-swimos', variable: 'CLOUDFRONT_DISTRIBUTION_ID')]) {
                            script {
                                sh "aws cloudfront create-invalidation --distribution-id '${CLOUDFRONT_DISTRIBUTION_ID}' --paths '/*'"
                            }
                        }
                    }
                }
            }
        }
    }
}