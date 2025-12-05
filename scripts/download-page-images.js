#!/usr/bin/env node
/*
  Download all images from a web page

  Requirements:
  - Node.js 18+ (for built-in fetch)
  - Optional: puppeteer for JavaScript-rendered pages (npm install puppeteer)
  - Optional: cheerio for better HTML parsing (npm install cheerio)

  Usage:
    node scripts/download-page-images.js <URL> [output-directory] [--cookies "cookie-string"] [--browser]
    
    Or set COOKIES environment variable:
    COOKIES="your-cookies" node scripts/download-page-images.js <URL> [output-directory] [--browser]

  Examples:
    # Public page
    node scripts/download-page-images.js https://example.com ./downloaded-images
    
    # Authenticated page (with cookies)
    node scripts/download-page-images.js https://example.com ./downloaded-images --cookies "session=abc123; auth=xyz789"
    
    # Use browser mode for JavaScript-rendered content (recommended for SPAs)
    node scripts/download-page-images.js https://example.com ./downloaded-images --cookies "session=abc123" --browser
    
    # Using environment variable
    COOKIES="session=abc123; auth=xyz789" node scripts/download-page-images.js https://example.com --browser

  How to get cookies:
    1. Open your browser and log into the website
    2. Open Developer Tools (F12 or Cmd+Option+I)
    3. Go to Application/Storage tab > Cookies
    4. Copy all cookie values in format: "name1=value1; name2=value2"
    5. Or use browser extension to copy cookies as a string
    6. Or run: document.cookie in the browser console
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Try to use puppeteer if available
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  // Puppeteer not installed, will use fetch method
}

// Try to use cheerio if available, otherwise use basic regex parsing
let cheerio;
try {
  cheerio = require('cheerio');
} catch (e) {
  console.warn('Warning: cheerio not found. Install it for better HTML parsing: npm install cheerio');
}

async function fetchPageWithBrowser(url, cookies = null) {
  if (!puppeteer) {
    throw new Error('Puppeteer not installed. Install it with: npm install puppeteer');
  }

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const networkImages = new Set();
    
    // Intercept network requests to capture images from API responses
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Capture direct image requests
      if (contentType.startsWith('image/')) {
        networkImages.add(url);
      }
      
      // Check JSON responses for image URLs
      if (contentType.includes('application/json') || contentType.includes('text/json')) {
        try {
          const json = await response.json();
          const jsonStr = JSON.stringify(json);
          // Find image URLs in JSON
          const imageUrlRegex = /https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?[^\s"']*)?/gi;
          let match;
          while ((match = imageUrlRegex.exec(jsonStr)) !== null) {
            networkImages.add(match[0]);
          }
        } catch (e) {
          // Not JSON or can't parse
        }
      }
    });
    
    // Set cookies if provided
    if (cookies) {
      const cookieArray = parseCookies(cookies, url);
      await page.setCookie(...cookieArray);
    }
    
    // Navigate to the page
    console.log('Loading page...');
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for initial content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll to load lazy-loaded content
    console.log('Scrolling page to load lazy-loaded images...');
    await autoScroll(page);
    
    // Scroll back up and down again to trigger more loading
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await autoScroll(page);
    
    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract all image URLs from the rendered page
    console.log('Extracting image URLs from DOM...');
    const domImageUrls = await page.evaluate(() => {
      const images = new Set();
      
      // Get all img elements
      document.querySelectorAll('img').forEach(img => {
        if (img.src && !img.src.startsWith('data:')) images.add(img.src);
        if (img.srcset) {
          img.srcset.split(',').forEach(src => {
            const url = src.trim().split(/\s+/)[0];
            if (url && !url.startsWith('data:')) images.add(url);
          });
        }
        // Check data attributes for lazy loading
        ['data-src', 'data-lazy', 'data-original', 'data-srcset', 'data-lazy-src'].forEach(attr => {
          const val = img.getAttribute(attr);
          if (val && !val.startsWith('data:')) {
            if (attr.includes('srcset')) {
              val.split(',').forEach(src => {
                const url = src.trim().split(/\s+/)[0];
                if (url) images.add(url);
              });
            } else {
              images.add(val);
            }
          }
        });
      });
      
      // Get picture and source elements
      document.querySelectorAll('picture source, source').forEach(source => {
        if (source.srcset) {
          source.srcset.split(',').forEach(src => {
            const url = src.trim().split(/\s+/)[0];
            if (url && !url.startsWith('data:')) images.add(url);
          });
        }
        if (source.src && !source.src.startsWith('data:')) {
          images.add(source.src);
        }
      });
      
      // Get background images from computed styles
      document.querySelectorAll('*').forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const bgImage = style.backgroundImage;
          if (bgImage && bgImage !== 'none') {
            const match = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/);
            if (match && match[1] && !match[1].startsWith('data:')) {
              images.add(match[1]);
            }
          }
        } catch (e) {
          // Skip if can't get computed style
        }
      });
      
      // Get images from style attributes
      document.querySelectorAll('[style*="background-image"], [style*="background"]').forEach(el => {
        const style = el.getAttribute('style');
        const matches = style.matchAll(/url\(['"]?([^'")]+)['"]?\)/g);
        for (const match of matches) {
          if (match[1] && !match[1].startsWith('data:')) {
            images.add(match[1]);
          }
        }
      });
      
      // Check for images in CSS
      document.querySelectorAll('style').forEach(styleEl => {
        const css = styleEl.textContent || styleEl.innerHTML;
        const matches = css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g);
        for (const match of matches) {
          if (match[1] && !match[1].startsWith('data:') && isImageUrl(match[1])) {
            images.add(match[1]);
          }
        }
      });
      
      function isImageUrl(url) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
        const urlLower = url.toLowerCase();
        return imageExtensions.some(ext => urlLower.includes(ext)) || 
               urlLower.includes('image') || 
               urlLower.includes('img');
      }
      
      return Array.from(images);
    });
    
    // Combine DOM images with network images
    const allImages = new Set([...domImageUrls, ...networkImages]);
    console.log(`Found ${domImageUrls.length} images in DOM, ${networkImages.size} from network requests`);
    
    return { html: await page.content(), imageUrls: Array.from(allImages) };
  } finally {
    await browser.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

function parseCookies(cookieString, url) {
  const urlObj = new URL(url);
  const cookies = [];
  
  cookieString.split(';').forEach(cookie => {
    const parts = cookie.trim().split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      
      cookies.push({
        name,
        value,
        domain: urlObj.hostname,
        path: '/'
      });
    }
  });
  
  return cookies;
}

async function fetchPage(url, cookies = null) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch page: ${error.message}`);
  }
}

function extractImageUrls(html, baseUrl) {
  const imageUrls = new Set();
  const baseUrlObj = new URL(baseUrl);

  if (cheerio) {
    // Use cheerio for better HTML parsing
    const $ = cheerio.load(html);
    
    // Find all img tags
    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      const srcset = $(elem).attr('srcset');
      const dataSrc = $(elem).attr('data-src'); // lazy-loaded images
      const dataSrcset = $(elem).attr('data-srcset');
      
      if (src) imageUrls.add(resolveUrl(src, baseUrlObj));
      if (dataSrc) imageUrls.add(resolveUrl(dataSrc, baseUrlObj));
      
      // Parse srcset
      if (srcset) {
        const urls = parseSrcset(srcset);
        urls.forEach(url => imageUrls.add(resolveUrl(url, baseUrlObj)));
      }
      if (dataSrcset) {
        const urls = parseSrcset(dataSrcset);
        urls.forEach(url => imageUrls.add(resolveUrl(url, baseUrlObj)));
      }
    });
    
    // Find background images in style attributes
    $('[style*="background-image"]').each((i, elem) => {
      const style = $(elem).attr('style');
      const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (match && match[1]) {
        imageUrls.add(resolveUrl(match[1], baseUrlObj));
      }
    });
    
    // Find background images in CSS
    $('style').each((i, elem) => {
      const css = $(elem).html();
      const matches = css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g);
      for (const match of matches) {
        if (match[1] && isImageUrl(match[1])) {
          imageUrls.add(resolveUrl(match[1], baseUrlObj));
        }
      }
    });
  } else {
    // Fallback: basic regex parsing (less reliable but works without dependencies)
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      imageUrls.add(resolveUrl(match[1], baseUrlObj));
    }
    
    // Also check data-src for lazy-loaded images
    const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["']/gi;
    while ((match = dataSrcRegex.exec(html)) !== null) {
      imageUrls.add(resolveUrl(match[1], baseUrlObj));
    }
    
    // Check for background images in style attributes
    const styleRegex = /style=["'][^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi;
    while ((match = styleRegex.exec(html)) !== null) {
      imageUrls.add(resolveUrl(match[1], baseUrlObj));
    }
  }

  return Array.from(imageUrls).filter(url => isImageUrl(url));
}

function parseSrcset(srcset) {
  // Parse srcset attribute: "image1.jpg 1x, image2.jpg 2x" or "image1.jpg 200w, image2.jpg 400w"
  return srcset.split(',').map(item => {
    const parts = item.trim().split(/\s+/);
    return parts[0];
  });
}

function resolveUrl(url, baseUrlObj) {
  try {
    // Handle relative URLs
    if (url.startsWith('//')) {
      return `${baseUrlObj.protocol}${url}`;
    }
    if (url.startsWith('/')) {
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
    }
    if (!url.startsWith('http')) {
      return new URL(url, baseUrlObj.href).href;
    }
    return url;
  } catch (e) {
    return url;
  }
}

function isImageUrl(url) {
  // Check if URL looks like an image
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const urlLower = url.toLowerCase();
  
  // Check file extension
  if (imageExtensions.some(ext => urlLower.includes(ext))) {
    return true;
  }
  
  // Check for common image URL patterns
  if (urlLower.includes('image') || urlLower.includes('img') || urlLower.includes('photo')) {
    return true;
  }
  
  // Check for data URLs (base64 images)
  if (url.startsWith('data:image/')) {
    return true;
  }
  
  return false;
}

function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname) || 'image';
    
    // If no extension, try to get it from the URL or default to .jpg
    if (!path.extname(filename)) {
      const contentTypeMatch = url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)/i);
      if (contentTypeMatch) {
        return `${filename}${contentTypeMatch[0]}`;
      }
      return `${filename}.jpg`;
    }
    
    return filename;
  } catch (e) {
    return `image-${Date.now()}.jpg`;
  }
}

async function downloadImage(imageUrl, outputDir, index, cookies = null) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    const response = await fetch(imageUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('Not an image');
    }
    
    const buffer = await response.arrayBuffer();
    const filename = getFilenameFromUrl(imageUrl);
    const filepath = path.join(outputDir, filename);
    
    // Handle duplicate filenames
    let finalFilepath = filepath;
    let counter = 1;
    while (fs.existsSync(finalFilepath)) {
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      finalFilepath = path.join(outputDir, `${name}-${counter}${ext}`);
      counter++;
    }
    
    fs.writeFileSync(finalFilepath, Buffer.from(buffer));
    return finalFilepath;
  } catch (error) {
    throw new Error(`Failed to download ${imageUrl}: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node scripts/download-page-images.js <URL> [output-directory] [--cookies "cookie-string"] [--browser]');
    console.error('\nOr set COOKIES environment variable:');
    console.error('  COOKIES="cookie-string" node scripts/download-page-images.js <URL> [output-directory] [--browser]');
    console.error('\nUse --browser flag for JavaScript-rendered pages (requires puppeteer)');
    process.exit(1);
  }
  
  const url = args[0];
  let outputDir = './downloaded-images';
  let cookies = process.env.COOKIES || null;
  let useBrowser = false;
  
  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--cookies' && i + 1 < args.length) {
      cookies = args[i + 1];
      i++; // Skip the cookie value in next iteration
    } else if (args[i] === '--browser') {
      useBrowser = true;
    } else if (!args[i].startsWith('--')) {
      outputDir = args[i];
    }
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    console.error(`Invalid URL: ${url}`);
    process.exit(1);
  }
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`Fetching page: ${url}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Mode: ${useBrowser ? 'Browser (Puppeteer)' : 'Fetch (HTTP)'}`);
  if (cookies) {
    console.log(`Using cookies: ${cookies.substring(0, 50)}...`);
  }
  console.log();
  
  try {
    let imageUrls = [];
    let html = '';
    
    if (useBrowser) {
      // Use browser mode for JavaScript-rendered content
      if (!puppeteer) {
        console.error('Error: --browser flag requires puppeteer. Install it with: npm install puppeteer');
        console.error('Falling back to fetch mode...\n');
        useBrowser = false;
      } else {
        console.log('Launching browser...');
        const result = await fetchPageWithBrowser(url, cookies);
        html = result.html;
        imageUrls = result.imageUrls.map(imgUrl => {
          try {
            return resolveUrl(imgUrl, new URL(url));
          } catch (e) {
            return imgUrl;
          }
        }).filter(url => isImageUrl(url));
        console.log(`Page rendered successfully\n`);
      }
    }
    
    if (!useBrowser) {
      // Fetch the page using HTTP
      html = await fetchPage(url, cookies);
      console.log(`Page fetched successfully (${html.length} bytes)\n`);
      
      // Extract image URLs
      console.log('Extracting image URLs...');
      imageUrls = extractImageUrls(html, url);
    }
    
    console.log(`Found ${imageUrls.length} unique image(s)\n`);
    
    if (imageUrls.length === 0) {
      console.log('No images found on the page.');
      console.log('Tip: Try using --browser flag for JavaScript-rendered pages');
      return;
    }
    
    // Download images
    console.log('Downloading images...\n');
    const results = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      try {
        const filepath = await downloadImage(imageUrl, outputDir, i, cookies);
        console.log(`[${i + 1}/${imageUrls.length}] ✓ ${path.basename(filepath)}`);
        results.push({ url: imageUrl, filepath, success: true });
      } catch (error) {
        console.error(`[${i + 1}/${imageUrls.length}] ✗ Failed: ${imageUrl}`);
        console.error(`  Error: ${error.message}`);
        results.push({ url: imageUrl, error: error.message, success: false });
      }
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n=== Summary ===`);
    console.log(`Total images found: ${imageUrls.length}`);
    console.log(`Successfully downloaded: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`\nImages saved to: ${path.resolve(outputDir)}`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

