
// inserts the copy code button in the top right corner and is enabled on hover
var codeBlocks = document.querySelectorAll('pre.highlight');
codeBlocks.forEach(function (codeBlock) {
  var copyButton = document.createElement('button');
  copyButton.className = 'copy';
  copyButton.type = 'button';
  copyButton.ariaLabel = 'Copy code to clipboard';
  copyButton.innerText = 'Copy';

  codeBlock.append(copyButton);

  copyButton.addEventListener('click', function () {
    var code = codeBlock.querySelector('code').innerText.trim();
    window.navigator.clipboard.writeText(code);

    copyButton.innerText = 'Copied';
    var fourSeconds = 4000;

    setTimeout(function () {
      copyButton.innerText = 'Copy';
    }, fourSeconds);
  });
});

// inserts the copy code button below the code block
/* const copyToClipboardButtonStrings = {
  default: 'Copy',
  ariaLabel: 'Copy to clipboard',
  copied: 'Copied',
};

const copyableCodeBlocks = document.querySelectorAll('pre.highlight');
copyableCodeBlocks.forEach((codeBlock) => {
  console.log("In code block")  
  const code = codeBlock.innerText;

  const copyCodeButton = document.createElement('button');
  copyCodeButton.className = 'copy-code-button bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
  copyCodeButton.innerText = copyToClipboardButtonStrings.default;
  copyCodeButton.setAttribute('aria-label', copyToClipboardButtonStrings.ariaLabel);
  copyCodeButton.type = 'button';
  codeBlock.parentElement.append(copyCodeButton);

  // Accessible alert whose inner text changes when we copy.
  const copiedAlert = document.createElement('span');
  copiedAlert.setAttribute('role', 'alert');
  copiedAlert.classList.add('screen-reader-only');
  codeBlock.parentElement.append(copiedAlert);

  copyCodeButton.addEventListener('click', () => {
    window.navigator.clipboard.writeText(code);
    copyCodeButton.classList.add('copied');
    copyCodeButton.innerText = copyToClipboardButtonStrings.copied;
    copiedAlert.innerText = copyToClipboardButtonStrings.copied;

    setTimeout(() => {
      copyCodeButton.classList.remove('copied');
      copyCodeButton.innerText = copyToClipboardButtonStrings.default;
      copiedAlert.innerText = '';
    }, 2000);
  });
}); */