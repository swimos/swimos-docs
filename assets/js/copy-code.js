
var setCopyButtonContent = function(copyButton) {
  if (!copyButton) {
    return;
  }

  var copyIcon = document.createElement('i');
  copyIcon.classList.add('copy-icon', 'fa-classic', 'fa-copy', 'w-[10px]', 'h-[10px]', 'text-white/70', 'mr-1');
  copyButton.innerText = 'Copy';
  copyButton.prepend(copyIcon);
}

// inserts the copy code button in the top right corner and is enabled on hover
var codeBlocks = document.querySelectorAll('pre.highlight');
codeBlocks.forEach(function (codeBlock) {
  var copyContainer = document.createElement('div');
  copyContainer.classList.add('copy-container', 'sticky', 'overflow-visible', 'top-0', 'left-0', 'w-full', 'h-0', 'flex', 'justify-end', 'pointer-events-none', 'bg-transparent');

  var copyButton = document.createElement('button');

  copyButton.classList.add('copy-button');
  copyButton.type = 'button';
  copyButton.ariaLabel = 'Copy code to clipboard';

  setCopyButtonContent(copyButton);

  copyContainer.append(copyButton);
  codeBlock.prepend(copyContainer);

  copyButton.addEventListener('click', function () {
    var code = codeBlock.querySelector('code').innerText.trim();
    window.navigator.clipboard.writeText(code);

    copyButton.innerText = 'Copied';
    var threeSeconds = 3000;

    setTimeout(function () {
      setCopyButtonContent(copyButton);
      copyButton.blur();
    }, threeSeconds);
  });
});
