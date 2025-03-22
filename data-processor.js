// data-processor.js
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Import the scraper module
const scraper = require('./enhanced-scraper');

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, 'resultados_salesianos_2025'),
  reportsDir: path.join(__dirname, 'reportes_salesianos'),
  exportFormats: ['json', 'csv', 'html']
};

// Ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await mkdirAsync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  } catch (error) {
    // Ignore if directory already exists
    if (error.code !== 'EEXIST') throw error;
  }
}

// Load JSON data from file
async function loadJsonFile(fileName) {
  try {
    const filePath = path.join(CONFIG.dataDir, fileName);
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading file ${fileName}: ${error.message}`);
    return null;
  }
}

// Convert data to CSV format
function convertToCSV(data, headers) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  // Create headers row if provided
  let csv = headers ? headers.join(',') + '\n' : '';
  
  // Process each row
  data.forEach(row => {
    if (Array.isArray(row)) {
      // Handle array of values
      csv += row.map(value => formatCSVValue(value)).join(',') + '\n';
    } else if (typeof row === 'object') {
      // Handle object with properties
      if (!headers) {
        // If headers weren't provided, use object keys
        headers = Object.keys(row);
        csv = headers.join(',') + '\n';
      }
      
      csv += headers.map(key => formatCSVValue(row[key])).join(',') + '\n';
    }
  });
  
  return csv;
}

// Format a value for CSV (handle strings with commas, quotes, etc.)
function formatCSVValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  
  const stringValue = String(value);
  
  // If value contains commas, quotes or newlines, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Double up any quotes within the value
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  
  return stringValue;
}

// Convert data to HTML table
function convertToHTMLTable(data, title, headers) {
  if (!Array.isArray(data) || data.length === 0) {
    return `<p>No data available for ${title}</p>`;
  }
  
  let html = `
    <div class="table-container">
      <h3>${title}</h3>
      <table border="1" cellpadding="5" cellspacing="0">
  `;
  
  // Add headers row if provided or infer from first row
  if (!headers && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    headers = Object.keys(data[0]);
  }
  
  if (headers) {
    html += '<thead><tr>';
    headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead>';
  }
  
  // Add data rows
  html += '<tbody>';
  data.forEach(row => {
    html += '<tr>';
    
    if (Array.isArray(row)) {
      // Handle array of values
      row.forEach(cell => {
        html += `<td>${formatHTMLValue(cell)}</td>`;
      });
    } else if (typeof row === 'object') {
      // Handle object with properties
      headers.forEach(key => {
        html += `<td>${formatHTMLValue(row[key])}</td>`;
      });
    }
    
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  return html;
}

// Format a value for HTML (escape HTML special chars)
function formatHTMLValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Create HTML page template
function createHTMLPage(title, content) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #1a5276;
      margin-bottom: 20px;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #2874a6;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    h3 {
      color: #2e86c1;
      margin-top: 25px;
      margin-bottom: 10px;
    }
    .table-container {
      margin-bottom: 30px;
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 10px;
    }
    th {
      background-color: #3498db;
      color: white;
      text-align: left;
    }
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    tr:hover {
      background-color: #ddd;
    }
    .medal-gold {
      background-color: #ffd700;
      font-weight: bold;
    }
    .medal-silver {
      background-color: #c0c0c0;
      font-weight: bold;
    }
    .medal-bronze {
      background-color: #cd7f32;
      font-weight: bold;
    }
    .notice {
      background-color: #f8f9fa;
      border-left: 4px solid #3498db;
      padding: 10px 15px;
      margin-bottom: 20px;
    }
    .timestamp {
      text-align: center;
      font-size: 0.8em;
      color: #7f8c8d;
      margin-top: 50px;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 20px;
    }
    .nav a {
      padding: 8px 15px;
      background-color: #3498db;
      color: white;
      text-decoration: none;
      border-radius: 3px;
    }
    .nav a:hover {
      background-color: #2874a6;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${content}
  <div class="timestamp">Generado el: ${new Date().toLocaleString('es-ES')}</div>
</body>
</html>
  `;
}

// Process and export all sports data
async function processAllSportsData() {
  try {
    console.log('Processing all sports data...');
    
    // Ensure reports directory exists
    await ensureDirectoryExists(CONFIG.reportsDir);
    
    // Load the combined data file
    const allData = await loadJsonFile('all_data.json');
    if (!allData) {
      throw new Error('Failed to load all_data.json file');
    }
    
    // Create navigation links for HTML reports
    const navLinks = [
      '<div class="nav">',
      '<a href="index.html">Inicio</a>'
    ];
    
    for (const sportName in allData.sports) {
      const sportFileName = sportName.toLowerCase().replace(/\s+/g, '_');
      navLinks.push(`<a href="${sportFileName}.html">${sportName}</a>`);
    }
    
    navLinks.push('</div>');
    const navigationHTML = navLinks.join('\n');
    
    // Create index page
    let indexContent = navigationHTML;
    
    // Add event information
    if (allData.mainPage && allData.mainPage.generalInfo) {
      indexContent += `
        <div class="notice">
          <h2>Información General</h2>
          <p><strong>Evento:</strong> ${allData.mainPage.generalInfo.title || 'Juegos Nacionales Salesianos 2025'}</p>
          <p><strong>Descripción:</strong> ${allData.mainPage.generalInfo.description || 'Información no disponible'}</p>
          <p><strong>Última actualización:</strong> ${new Date(allData.metadata.scrapedAt).toLocaleString('es-ES')}</p>
        </div>
      `;
    }
    
    // Add announcements if available
    if (allData.mainPage && allData.mainPage.announcements && allData.mainPage.announcements.length > 0) {
      indexContent += `<h2>Anuncios</h2>`;
      
      allData.mainPage.announcements.forEach(announcement => {
        indexContent += `
          <div class="notice">
            <h3>${announcement.title || 'Anuncio'}</h3>
            <p>${announcement.content || ''}</p>
          </div>
        `;
      });
    }
    
    // Add latest news if available
    if (allData.mainPage && allData.mainPage.news && allData.mainPage.news.length > 0) {
      indexContent += `<h2>Últimas Noticias</h2>`;
      
      const newsHTML = convertToHTMLTable(
        allData.mainPage.news,
        'Noticias',
        ['title', 'date', 'summary']
      );
      
      indexContent += newsHTML;
    }
    
    // Add schedule information if available
    if (allData.mainPage && allData.mainPage.scheduleItems && allData.mainPage.scheduleItems.length > 0) {
      indexContent += `<h2>Calendario de Eventos</h2>`;
      
      const scheduleHTML = convertToHTMLTable(
        allData.mainPage.scheduleItems,
        'Próximos Eventos',
        ['title', 'date', 'location', 'description']
      );
      
      indexContent += scheduleHTML;
    }
    
    // Add standings if available
    if (allData.mainPage && allData.mainPage.standings && allData.mainPage.standings.length > 0) {
      indexContent += `<h2>Clasificaciones Generales</h2>`;
      
      allData.mainPage.standings.forEach(standing => {
        const standingHTML = convertToHTMLTable(
          standing.rows,
          standing.title,
          null // Use the first row as headers
        );
        
        indexContent += standingHTML;
      });
    }
    
    // Add list of sports
    indexContent += `<h2>Disciplinas Deportivas</h2>`;
    indexContent += `<ul>`;
    
    for (const sportName in allData.sports) {
      const sportFileName = sportName.toLowerCase().replace(/\s+/g, '_');
      indexContent += `<li><a href="${sportFileName}.html">${sportName}</a></li>`;
    }
    
    indexContent += `</ul>`;
    
    // Save index HTML
    const indexHTML = createHTMLPage('Juegos Nacionales Salesianos 2025', indexContent);
    await writeFileAsync(path.join(CONFIG.reportsDir, 'index.html'), indexHTML);
    
    // Process each sport
    for (const sportName in allData.sports) {
      const sport = allData.sports[sportName];
      const sportFileName = sportName.toLowerCase().replace(/\s+/g, '_');
      
      // Create sport page content
      let sportContent = navigationHTML;
      
      // Add sport information
      sportContent += `
        <div class="notice">
          <h2>${sport.sportInfo.title || sportName}</h2>
          <p>${sport.sportInfo.description || ''}</p>
        </div>
      `;
      
      // Add results tables if available
      if (sport.results && sport.results.length > 0) {
        sportContent += `<h2>Resultados</h2>`;
        
        sport.results.forEach(result => {
          const resultHTML = convertToHTMLTable(
            result.data,
            result.title,
            null // Use the first row as headers
          );
          
          sportContent += resultHTML;
        });
        
        // Save results as CSV
        for (let i = 0; i < sport.results.length; i++) {
          const result = sport.results[i];
          const csvData = convertToCSV(result.data);
          const csvFileName = `${sportFileName}_resultados_${i+1}.csv`;
          await writeFileAsync(path.join(CONFIG.reportsDir, csvFileName), csvData);
        }
      }
      
      // Add matches/events if available
      if (sport.matches && sport.matches.length > 0) {
        sportContent += `<h2>Partidos/Eventos</h2>`;
        
        const matchesHTML = convertToHTMLTable(
          sport.matches,
          'Partidos',
          Object.keys(sport.matches[0])
        );
        
        sportContent += matchesHTML;
        
        // Save matches as CSV
        const csvData = convertToCSV(sport.matches, Object.keys(sport.matches[0]));
        const csvFileName = `${sportFileName}_partidos.csv`;
        await writeFileAsync(path.join(CONFIG.reportsDir, csvFileName), csvData);
      }
      
      // Add standings if available
      if (sport.standings && sport.standings.length > 0) {
        sportContent += `<h2>Clasificaciones</h2>`;
        
        sport.standings.forEach(standing => {
          sportContent += `<h3>${standing.title}${standing.category ? ' - ' + standing.category : ''}</h3>`;
          
          const standingHTML = convertToHTMLTable(
            standing.teams,
            '',
            Object.keys(standing.teams[0])
          );
          
          sportContent += standingHTML;
        });
        
        // Save standings as CSV
        for (let i = 0; i < sport.standings.length; i++) {
          const standing = sport.standings[i];
          const csvData = convertToCSV(standing.teams, Object.keys(standing.teams[0]));
          const csvFileName = `${sportFileName}_clasificacion_${i+1}.csv`;
          await writeFileAsync(path.join(CONFIG.reportsDir, csvFileName), csvData);
        }
      }
      
      // Add medals if available
      if (sport.medals && sport.medals.length > 0) {
        sportContent += `<h2>Medallero</h2>`;
        
        sport.medals.forEach(medal => {
          sportContent += `<h3>${medal.title}</h3>`;
          
          const medalHTML = convertToHTMLTable(
            medal.items,
            '',
            Object.keys(medal.items[0])
          );
          
          sportContent += medalHTML;
        });
        
        // Save medals as CSV
        for (let i = 0; i < sport.medals.length; i++) {
          const medal = sport.medals[i];
          const csvData = convertToCSV(medal.items, Object.keys(medal.items[0]));
          const csvFileName = `${sportFileName}_medallero_${i+1}.csv`;
          await writeFileAsync(path.join(CONFIG.reportsDir, csvFileName), csvData);
        }
      }
      
      // Add news if available
      if (sport.news && sport.news.length > 0) {
        sportContent += `<h2>Noticias</h2>`;
        
        sport.news.forEach(newsItem => {
          sportContent += `
            <div class="notice">
              <h3>${newsItem.title || 'Noticia'}</h3>
              ${newsItem.date ? `<p><small>${newsItem.date}</small></p>` : ''}
              <p>${newsItem.content || ''}</p>
              ${newsItem.author ? `<p><small>Por: ${newsItem.author}</small></p>` : ''}
            </div>
          `;
        });
      }
      
      // Add gallery if available
      if (sport.gallery && sport.gallery.length > 0) {
        sportContent += `<h2>Galería</h2>`;
        sportContent += `<div style="display: flex; flex-wrap: wrap; gap: 10px;">`;
        
        sport.gallery.forEach(image => {
          sportContent += `
            <div style="margin-bottom: 15px; text-align: center;">
              <img src="${image.url}" alt="${image.title}" style="max-width: 200px; max-height: 150px; object-fit: cover;">
              ${image.caption ? `<p><small>${image.caption}</small></p>` : ''}
            </div>
          `;
        });
        
        sportContent += `</div>`;
      }
      
      // Save sport HTML
      const sportHTML = createHTMLPage(`${sportName} - Juegos Nacionales Salesianos 2025`, sportContent);
      await writeFileAsync(path.join(CONFIG.reportsDir, `${sportFileName}.html`), sportHTML);
      
      console.log(`Processed ${sportName} data`);
    }
    
    console.log(`Data processing complete. Reports saved to ${CONFIG.reportsDir}`);
    return true;
  } catch (error) {
    console.error('Error processing data:', error);
    return false;
  }
}

// Main function to run scraper and process data
async function runScraperAndProcessData() {
  try {
    console.log('Starting the scraping and data processing...');
    
    // Run the scraper
    const summary = await scraper.runScraper();
    console.log('Scraping completed with summary:', summary);
    
    // Process the scraped data
    const processed = await processAllSportsData();
    
    if (processed) {
      console.log(`
===========================================
SCRAPING AND PROCESSING COMPLETED SUCCESSFULLY
===========================================

Raw data directory: ${CONFIG.dataDir}
Processed reports: ${CONFIG.reportsDir}

You can view the HTML reports by opening:
${path.join(CONFIG.reportsDir, 'index.html')}

CSV exports for each sport are also available in the reports directory.
      `);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Fatal error in scraping or processing:', error);
    return { success: false, error: error.message };
  }
}

// Direct execution
if (require.main === module) {
  runScraperAndProcessData()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Process failed with error:', error);
      process.exit(1);
    });
} else {
  // Export functions for use as a module
  module.exports = {
    processAllSportsData,
    runScraperAndProcessData,
    CONFIG
  };
}
