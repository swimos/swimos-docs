# require "html-proofer"

# Jekyll::Hooks.register :site, :post_write do |site|
#   HTMLProofer.check_directory(site.config["destination"], opts = {
#     :allow_hash_href => false,
#     :check_html => true,
#     :disable_external => true,
#     :enforce_https => false,
#     :ignore_empty_alt => false,
#     :ignore_missing_alt => false,
#     :url_swap => "^/" + site.config["baseurl"] + "/:/"
#   }).run
# end
