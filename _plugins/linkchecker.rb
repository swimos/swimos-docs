require "html-proofer"

Jekyll::Hooks.register :site, :post_write do |site|
  HTMLProofer.check_directory(site.config["destination"], opts = {
    :allow_hash_href => false,
    :allow_missing_href => true,
    :check_html => true,
    :disable_external => false,
    :enforce_https => false,
    :ignore_empty_alt => true,
    :ignore_missing_alt => true,
    # :swap_urls => {
    #   Regexp.new("^" + site.config["baseurl"]) => ""
    # },
    ignore_urls: [/localhost/,/twitter.com/,/linkedin.com/],
    ignore_status_codes: [403, 500]
  }).run
end
