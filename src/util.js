import blobFromDataUri from 'blueimp-canvas-to-blob';
import csjs from 'csjs-inject';
import getCss from 'csjs/get-css';

import resetCss from './styles/reset-css.js';


export function clone() {
  return Object.assign({}, ...arguments);
}


/**
 * Attempts to load a JSON value from localStorage.
 * @param {string} key The localStorage key.
 * @param defaultValue The default value returned if item is not found.
 * @returns {*}
 */
export function getFromLocalStorage(key, defaultValue=null) {
  var value = localStorage.getItem(key);
  try {
    value = JSON.parse(value);
  }
  catch (e) {}
  const isStored = value !== null;
  return isStored ? value : defaultValue;
}


/**
 * Formats a number into US dollars.
 * @param {number} price The amount to be formatted.
 * @returns {string}
 */
export function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}


export async function orderPostcard(apiKey, to, from, size, front, back) {
  const LOB_ENDPOINT = 'https://api.lob.com/v1/postcards';

  return new Promise(resolve => {
    try {
      var form = new FormData();
      form.append('to[name]', to.addressName);
      form.append('to[address_line1]', to.addressLine1);
      form.append('to[address_line2]', to.addressLine2);
      form.append('to[address_country]', to.addressCountry);
      form.append('to[address_city]', to.addressCity);
      form.append('to[address_state]', to.addressState);
      form.append('to[address_zip]', to.addressZip);
      form.append('from[name]', from.addressName);
      form.append('from[address_line1]', from.addressLine1);
      form.append('from[address_line2]', from.addressLine2);
      form.append('from[address_country]', from.addressCountry);
      form.append('from[address_city]', from.addressCity);
      form.append('from[address_state]', from.addressState);
      form.append('from[address_zip]', from.addressZip);
      form.append('size', size);
      form.append('front', blobFromDataUri(front), 'front.png');
      form.append('back', blobFromDataUri(back), 'back.png');

      var request = new XMLHttpRequest();
      request.addEventListener('load', requestFinished);
      request.open('POST', LOB_ENDPOINT, true);
      request.setRequestHeader('Authorization', `Basic ${btoa(apiKey+':')}`);
      request.send(form);

      function requestFinished(e) {
        resolve(e.target);
      }
    }
    catch (e) {
      console.log('wtfffffffff', e);
    }
  });
}


export async function drawFront(size, imgData, dpi) {
  const { width, height } = size;
  function d(distance) {
    return distance * dpi;
  }

  const img = await loadImageFromData(imgData);
  const rotate = img.width < img.height;

  var trimSides, degrees, scale, translate;
  if (rotate) {
    trimSides = (img.width / img.height) < (height / width);
    degrees = [90, img.height / 2, img.height / 2];
    scale = trimSides ? (d(height) / img.width) : (d(width) / img.height);
    translate = trimSides ? [-((scale * img.height - d(width)) / 2), 0] : [0, -((scale * img.width - d(height)) / 2)];
  }
  else {
    trimSides = (img.width / img.height) > (width / height);
    degrees = [0];
    scale = trimSides ? (d(height) / img.height) : (d(width) / img.width);
    translate = trimSides ? [-((scale * img.width - d(width)) / 2), 0] : [0, -((scale * img.height - d(height)) / 2)];
  }

  var svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${d(width)}" height="${d(height)}">
        <image width="${img.width}" height="${img.height}" transform="translate(${translate.join(' ')}) scale(${scale}) rotate(${degrees.join(' ')})" xlink:href="${imgData}"></image>
      </svg>
    `;

  const svgDataUrl = 'data:image/svg+xml,' + svgString;
  const svgImg = await loadImageFromData(svgDataUrl);

  var canvas = document.createElement('canvas');
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(svgImg, 0, 0);
  return canvas.toDataURL();
}


export async function drawBack(size, message, dpi, fromAddress=null, toAddress=null) {
  const { width, height, textWidth } = size;
  const showAddresses = fromAddress && toAddress;
  function d(distance) {
    return distance * dpi;
  }

  const styles = csjs`

    .container {
      position: absolute;
      width: ${d(width)}px;
      height: ${d(height)}px;
      padding: ${d(0.2)}px;
      box-sizing: border-box;
    }

    .textContainer {
      width: ${d(textWidth)}px;
    }

    .message {
      font-size: ${d(message.fontSize/100)}px;
      font-family: ${message.font};
    }

    .addressContainer {
      display: ${showAddresses ? 'block' : 'none'};
      position: absolute;
      width: ${d(size.addressWidth)}px;
      height: ${d(size.addressHeight)}px;
      left: ${d(size.addressLeft)}px;
      top: ${d(size.addressTop)}px;
      border: ${d(0.01)}px solid black;
      font-size: ${d(message.fontSize/100)}px;
    }

    .addressText {
      position: absolute;
      font-family: Arial;
      text-transform: uppercase;
    }

    .fromAddress extends .addressText {
      left: ${d(size.addressesLeft)}px;
      top: ${d(0.266)}px;
      font-size: ${d(11/100)}px;
    }

    .toAddress extends .addressText {
      left: ${d(size.addressesLeft)}px;
      top: ${d(1.339)}px;
      font-size: ${d(14/100)}px;
    }

    .postage extends .addressText {
      width: ${d(0.78)}px;
      height: ${d(0.639)}px;
      left: ${d(size.postageLeft)}px;
      top: ${d(0.181)}px;
      border: ${d(0.01)}px solid black;
      text-align: center;
      background: #aaa;
    }

  `;

  const formatText = text => String(text).replace(/\n/g, '<br/>');
  const formatAddress = a => formatText(
    `${a.addressName}
    ${a.addressLine1}${a.addressLine2 ? `\n${a.addressLine2}` : ''}
    ${a.addressCity}, ${a.addressState} ${a.addressZip}`
  );

  const messageText = formatText(message.content);
  const fromAddressText = fromAddress ? formatAddress(fromAddress) : '';
  const toAddressText = toAddress ? formatAddress(toAddress) : '';

  var svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${d(width)}" height="${d(height)}">
      <foreignObject width="100%" height="100%">
        <style>${resetCss}</style>
        <style>${getCss(styles)}</style>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <div class="${styles.container}">
            <div class="${styles.textContainer}">
              <span class="${styles.message}">${messageText}</span>
            </div>
            <div class="${styles.addressContainer}">
              <div class="${styles.postage}"></div>
              <div class="${styles.fromAddress}">${fromAddressText}</div>
              <div class="${styles.toAddress}">${toAddressText}</div>
            </div>
          </div>
        </div>
      </foreignObject>
    </svg>
  `;

  const svgDataUrl = 'data:image/svg+xml,' + svgString;
  const svgImg = await loadImageFromData(svgDataUrl);

  var canvas = document.createElement('canvas');
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(svgImg, 0, 0);
  return canvas.toDataURL();
}


export async function rotateImageToLandscape(data) {
  try {
    return new Promise(async resolve => {
      // return loaded image if already landscape
      var img = await loadImageFromData(data);
      if (img.width >= img.height) return resolve(img);

      // make a canvas with switched width/height
      var canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;

      // draw image on rotated canvas
      var ctx = canvas.getContext('2d');
      ctx.save();
      ctx.translate(canvas.width, canvas.height/canvas.width);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      // render and return loaded image
      const rotatedData = canvas.toDataURL();
      const rotatedImg = await loadImageFromData(rotatedData);
      return resolve(rotatedImg);
    });
  }
  catch (e) {
    console.log('error!!!!!!!!!!!!!', e);
  }
}


export async function loadImageFromData(data) {
  return new Promise(resolve => {
    var img = new Image();
    img.src = data;
    img.onload = () => resolve(img);
  });
}
