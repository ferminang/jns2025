// web-scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Base URL for the website
const baseUrl = 'https://clasico.com.do/juegos-nacionales-salesianos-2025/';

// Sports disciplines to scrape
const sportsDisciplines = [
  'Fútbol', 'Atletismo', 'Baloncesto', 'Ajedrez', 
  'Voleibol', 'Tenis de Mesa', 'Béisbol', 'Fútbol Sala'
];

// Convert sport names to URL-friendly format
function getSportUrl(sport) {
  const sportLower = sport.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, '-'); // Replace spaces with hyphens
  return `${baseUrl}${sportLower}/`;
}

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'resultados_salesianos_2025');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Helper function to save data to file
function saveToFile(filename, data) {
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Data saved to ${filePath}`);
}

// Function to scrape the main page
async function scrapeMainPage() {
  try {
    console.log(`Scraping main page: ${baseUrl}`);
    const response = await axios.get(baseUrl);
    const $ = cheerio.load(response.data);
    
    // Extract general information
    const generalInfo = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      lastUpdated: new Date().toISOString()
    };
    
    // Extract any news or highlights from the main page
    const highlights = [];
    $('.entry-content article, .post, .article').each((i, element) => {
      const highlight = {
        title: $(element).find('h2, .title').text().trim(),
        date: $(element).find('.date, .posted-on').text().trim(),
        summary: $(element).find('p').first().text().trim(),
        link: $(element).find('a').attr('href') || ''
      };
      if (highlight.title) {
        highlights.push(highlight);
      }
    });
    
    // Extract main navigation links
    const navigationLinks = [];
    $('nav a, .menu a, .navigation a').each((i, element) => {
      const link = {
        text: $(element).text().trim(),
        url: $(element).attr('href') || ''
      };
      if (link.text && link.url && !navigationLinks.some(l => l.url === link.url)) {
        navigationLinks.push(link);
      }
    });
    
    const mainPageData = {
      generalInfo,
      highlights,
      navigationLinks
    };
    
    saveToFile('main_page.json', mainPageData);
    return mainPageData;
  } catch (error) {
    console.error(`Error scraping main page: ${error.message}`);
    return null;
  }
}

// Function to scrape a sport discipline page
async function scrapeSportPage(sport) {
  const sportUrl = getSportUrl(sport);
  try {
    console.log(`Scraping ${sport} page: ${sportUrl}`);
    const response = await axios.get(sportUrl);
    const $ = cheerio.load(response.data);
    
    // Extract sport-specific information
    const sportInfo = {
      sport,
      url: sportUrl,
      title: $('h1, .entry-title').first().text().trim() || sport
    };
    
    // Extract results tables
    const results = [];
    $('table').each((i, table) => {
      const tableTitle = $(table).prev('h2, h3, h4').text().trim() || `Table ${i+1}`;
      
      const tableData = [];
      $(table).find('tr').each((j, row) => {
        const rowData = [];
        $(row).find('th, td').each((k, cell) => {
          rowData.push($(cell).text().trim());
        });
        if (rowData.length > 0) {
          tableData.push(rowData);
        }
      });
      
      if (tableData.length > 0) {
        results.push({
          title: tableTitle,
          data: tableData
        });
      }
    });
    
    // Extract match/event information
    const matches = [];
    $('.match, .event, .fixture, article').each((i, element) => {
      const match = {
        teams: $(element).find('.team-name, .participant').map((i, el) => $(el).text().trim()).get(),
        result: $(element).find('.score, .result').text().trim(),
        date: $(element).find('.date, .datetime').text().trim(),
        location: $(element).find('.venue, .location').text().trim()
      };
      
      if (match.teams.length > 0 || match.result) {
        matches.push(match);
      }
    });
    
    // Extract any news or updates specific to this sport
    const news = [];
    $('.news, .post, .update').each((i, element) => {
      const newsItem = {
        title: $(element).find('h2, h3, .title').text().trim(),
        date: $(element).find('.date').text().trim(),
        content: $(element).find('p').text().trim()
      };
      
      if (newsItem.title || newsItem.content) {
        news.push(newsItem);
      }
    });
    
    const sportData = {
      sportInfo,
      results,
      matches,
      news
    };
    
    // Save sport-specific data to file
    const filename = `${sport.toLowerCase().replace(/\s+/g, '_')}.json`;
    saveToFile(filename, sportData);
    return sportData;
  } catch (error) {
    console.error(`Error scraping ${sport} page: ${error.message}`);
    return null;
  }
}

// Main function to run the scraper
async function runScraper() {
  console.log('Starting web scraper for Juegos Nacionales Salesianos 2025');
  
  // Scrape main page
  const mainPageData = await scrapeMainPage();
  
  // Scrape each sport discipline
  const sportsData = {};
  for (const sport of sportsDisciplines) {
    sportsData[sport] = await scrapeSportPage(sport);
    // Add a small delay between requests to be respectful to the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save combined data
  const allData = {
    mainPage: mainPageData,
    sports: sportsData,
    scrapedAt: new Date().toISOString()
  };
  
  saveToFile('all_data.json', allData);
  console.log('Web scraping completed successfully!');
}

// Run the scraper
runScraper().catch(error => {
  console.error('Error in the scraping process:', error);
});
