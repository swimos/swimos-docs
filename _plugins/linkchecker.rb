# require "html-proofer"

# Jekyll::Hooks.register :site, :post_write do |site|
#   if site.config['JEKYLL_ENV'] == "development"
#     HTMLProofer.check_directory(site.config["destination"], opts = {
#       :allow_hash_href => true,
#       :check_html => true,
#       :check_img_http => true,
#       :disable_external => false,
#       :enforce_https => false,
#       :report_invalid_tags => true,
#     }).run
#     elseif site.config['JEKYLL_ENV'] == "production"
#       HTMLProofer.check_directory(site.config["destination"], opts = {
#         :allow_hash_href => true,
#         :check_html => true,
#         :check_img_http => true,
#         :disable_external => false,
#         :enforce_https => true,
#         :report_invalid_tags => true,
#       }).run
#     else
#       HTMLProofer.check_directory(site.config["destination"], opts = {
#         :allow_hash_href => true,
#         :check_html => true,
#         :check_img_http => true,
#         :disable_external => true,
#         :enforce_https => false,
#         :report_invalid_tags => true,
#       }).run
#   end
# end