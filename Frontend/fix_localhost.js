const fs = require('fs');
const path = require('path');

const walk = function(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const DIRS = [
  path.join(__dirname, 'app'),
  path.join(__dirname, 'components'),
  path.join(__dirname, 'lib')
];

function processFiles(files) {
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Is it a client component?
    const isClient = content.includes('"use client"') || content.includes("'use client'") || file.includes('components\\');

    // Regex to match things like: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    // and replace with "" (if client) or process.env.NEXT_PUBLIC_API_URL || 'https://dev.outmate.ai' (if server)
    
    // First, for client code, we want to remove NEXT_PUBLIC_API_URL bypasses
    if (isClient) {
      content = content.replace(/(?:\$\{)?(?:process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*)?['"]http:\/\/localhost:8000['"](?:\})?/g, '""');
      content = content.replace(/(?:\$\{)?(?:process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*)?['"]https:\/\/dev\.outmate\.ai['"](?:\})?/g, '""');
      
      // Also catch const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      content = content.replace(/process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:8000['"]/g, '""');
    } else {
      // For server code, just replace localhost:8000 with https://dev.outmate.ai
      content = content.replace(/http:\/\/localhost:8000/g, 'https://dev.outmate.ai');
    }

    // Replace any leftover localhost:8000 just in case
    if (isClient) {
        content = content.replace(/http:\/\/localhost:8000/g, '');
    } else {
        content = content.replace(/http:\/\/localhost:8000/g, 'https://dev.outmate.ai');
    }

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed', file);
    }
  });
}

let allFiles = [];
let dirsPending = DIRS.length;

DIRS.forEach(d => {
  if (fs.existsSync(d)) {
    walk(d, (err, files) => {
      if (!err) allFiles = allFiles.concat(files);
      if (!--dirsPending) {
         processFiles(allFiles);
      }
    });
  } else {
    if (!--dirsPending) {
         processFiles(allFiles);
    }
  }
});
