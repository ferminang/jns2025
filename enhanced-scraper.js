// enhanced-scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Convert fs.writeFile to promise-based
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Base URL configuration
const CONFIG = {
  baseUrl: 'https://clasico.com.do/juegos-nacionales-salesianos-2025/',
  outputDir: path.join(__dirname, 'resultados_salesianos_2025'),
  requestDelay: 1500, // 1.5 seconds delay between requests
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds delay before retry
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeoutMs: 30000 // 30 seconds timeout
};

// Sports disciplines to scrape with normalized URLs
const SPORTS = [
  { name: 'Fútbol', urlPath: 'futbol' },
  { name: 'Atletismo', urlPath: 'atletismo' },
  { name: 'Baloncesto', urlPath: 'baloncesto' },
  { name: 'Ajedrez', urlPath: 'ajedrez' },
  { name: 'Voleibol', urlPath: 'voleibol' },
  { name: 'Tenis de Mesa', urlPath: 'tenis-de-mesa' },
  { name: 'Béisbol', urlPath: 'beisbol' },
  { name: 'Fútbol Sala', urlPath: 'futbol-sala' }
];

// Set up axios instance with default settings
const axiosInstance = axios.create({
  timeout: CONFIG.timeoutMs,
  headers: {
    'User-Agent': CONFIG.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry failed requests
async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  try {
    const response = await axiosInstance.get(url, options);
    return response;
  } catch (error) {
    if (retries <= 0) throw error;
    
    console.log(`Retrying ${url} - Attempts remaining: ${retries}`);
    await delay(CONFIG.retryDelay);
    return fetchWithRetry(url, options, retries - 1);
  }
}

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await mkdirAsync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  } catch (error) {
    // Ignore if directory already exists
    if (error.code !== 'EEXIST') throw error;
  }
}

// Helper function to save data to file
async function saveToFile(filename, data) {
  try {
    const filePath = path.join(CONFIG.outputDir, filename);
    await writeFileAsync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Data saved to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Failed to save file ${filename}: ${error.message}`);
    return false;
  }
}

// Helper function to save HTML content for debugging
async function saveHtmlForDebugging(sportName, html) {
  try {
    const debugDir = path.join(CONFIG.outputDir, 'debug');
    await ensureDirectoryExists(debugDir);
    const filePath = path.join(debugDir, `${sportName.toLowerCase().replace(/\s+/g, '_')}.html`);
    await writeFileAsync(filePath, html, 'utf8');
    console.log(`Debug HTML saved to ${filePath}`);
  } catch (error) {
    console.error(`Failed to save debug HTML for ${sportName}: ${error.message}`);
  }
}

// Function to extract structured data from HTML using different selectors
function extractWithFallbackSelectors($, selectors, context = null) {
  const element = context || $;
  
  for (const selector of selectors) {
    const result = element.find(selector).first();
    if (result.length > 0) {
      return result;
    }
  }
  
  return element.find(selectors[0]); // Return empty result if nothing found
}

// Function to scrape the main page
async function scrapeMainPage() {
  try {
    console.log(`Scraping main page: ${CONFIG.baseUrl}`);
    const response = await fetchWithRetry(CONFIG.baseUrl);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // For debugging
    await saveHtmlForDebugging('main_page', html);
    
    // Extract general information
    const generalInfo = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      heroImage: $('header img, .hero img, .banner img').first().attr('src') || '',
      lastUpdated: new Date().toISOString()
    };
    
    // Extract any announcements or important notices
    const announcements = [];
    $('.announcement, .notice, .alert, .important').each((i, element) => {
      const announcement = {
        title: $(element).find('h2, h3, .title, strong').first().text().trim(),
        content: $(element).text().trim().replace(/\s+/g, ' ')
      };
      
      if (announcement.title || announcement.content) {
        announcements.push(announcement);
      }
    });
    
    // Extract latest news and updates
    const news = [];
    $('.news, .post, article, .entry').each((i, element) => {
      const newsItem = {
        title: $(element).find('h2, h3, .title, .entry-title').first().text().trim(),
        date: $(element).find('.date, .posted-on, time').first().text().trim(),
        summary: $(element).find('p, .excerpt, .summary').first().text().trim(),
        imageUrl: $(element).find('img').first().attr('src') || '',
        link: $(element).find('a').first().attr('href') || ''
      };
      
      if (newsItem.title) {
        news.push(newsItem);
      }
    });
    
    // Extract schedule information
    const scheduleItems = [];
    $('.schedule, .calendar, .event-list, .fixtures').each((i, element) => {
      $(element).find('li, .event, .fixture, .match').each((j, eventEl) => {
        const item = {
          title: $(eventEl).find('h3, h4, .event-title, .title').first().text().trim(),
          date: $(eventEl).find('.date, time, .datetime').first().text().trim(),
          location: $(eventEl).find('.venue, .location, .place').first().text().trim(),
          description: $(eventEl).find('p, .description').first().text().trim()
        };
        
        if (item.title || item.date) {
          scheduleItems.push(item);
        }
      });
    });
    
    // Extract navigation links and sport discipline links
    const navigationLinks = [];
    $('nav a, .menu a, .navigation a, .main-menu a').each((i, element) => {
      const link = {
        text: $(element).text().trim(),
        url: $(element).attr('href') || '',
        isActive: $(element).hasClass('active') || $(element).parent().hasClass('active'),
        isSport: SPORTS.some(sport => 
          $(element).text().trim().toLowerCase().includes(sport.name.toLowerCase()) || 
          ($(element).attr('href') || '').includes(sport.urlPath)
        )
      };
      
      if (link.text && link.url && !navigationLinks.some(l => l.url === link.url)) {
        navigationLinks.push(link);
      }
    });
    
    // Extract medal tally or standings if available
    const standings = [];
    $('.standings, .medal-tally, .results-summary, .leaderboard').each((i, element) => {
      const standingTable = { title: '', rows: [] };
      
      standingTable.title = $(element).prev('h2, h3, h4').text().trim() || 
                            $(element).find('caption, .table-title').text().trim() || 
                            'Standings';
      
      $(element).find('tr').each((j, row) => {
        const cells = [];
        $(row).find('th, td').each((k, cell) => {
          cells.push($(cell).text().trim());
        });
        
        if (cells.length > 0) {
          standingTable.rows.push(cells);
        }
      });
      
      if (standingTable.rows.length > 0) {
        standings.push(standingTable);
      }
    });
    
    const mainPageData = {
      generalInfo,
      announcements,
      news,
      scheduleItems,
      navigationLinks,
      standings,
      sportLinks: navigationLinks.filter(link => link.isSport)
    };
    
    await saveToFile('main_page.json', mainPageData);
    return mainPageData;
  } catch (error) {
    console.error(`Error scraping main page: ${error.message}`);
    return null;
  }
}

// Function to scrape a sport discipline page
async function scrapeSportPage(sport) {
  const sportUrl = `${CONFIG.baseUrl}${sport.urlPath}/`;
  
  try {
    console.log(`Scraping ${sport.name} page: ${sportUrl}`);
    const response = await fetchWithRetry(sportUrl);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // For debugging
    await saveHtmlForDebugging(sport.name, html);
    
    // Extract sport-specific information
    const sportInfo = {
      name: sport.name,
      url: sportUrl,
      title: extractWithFallbackSelectors($, ['h1', '.entry-title', '.page-title']).first().text().trim() || sport.name,
      description: $('.description, .intro, .summary').first().text().trim()
    };
    
    // Extract hero image if available
    const heroImage = $('header img, .hero img, .featured-image img').first().attr('src') || '';
    if (heroImage) {
      sportInfo.heroImage = heroImage;
    }
    
    // Extract results tables
    const results = [];
    $('table, .table, .results-table').each((i, table) => {
      // Try to get table title from nearby headings or caption
      let tableTitle = $(table).prev('h2, h3, h4').text().trim() || 
                       $(table).find('caption').text().trim() || 
                       `Resultados ${i+1}`;
      
      // Check for category/group information
      const category = $(table).prev('.category, .group, .division').text().trim() || 
                       $(table).closest('.category-container, .group-container').find('h3, h4, .title').first().text().trim();
      
      if (category && !tableTitle.includes(category)) {
        tableTitle = `${category} - ${tableTitle}`;
      }
      
      const tableData = [];
      $(table).find('tr').each((j, row) => {
        const rowData = [];
        $(row).find('th, td').each((k, cell) => {
          // Handle rich cell content (including links, images, etc)
          let cellText = $(cell).text().trim();
          
          // Check for specific classes or data attributes
          if ($(cell).hasClass('winner') || $(cell).attr('data-winner') === 'true') {
            rowData.push({ text: cellText, isWinner: true });
          } else if ($(cell).find('img').length > 0) {
            const imgSrc = $(cell).find('img').attr('src') || '';
            rowData.push({ text: cellText, imgSrc });
          } else {
            rowData.push(cellText);
          }
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
    $('.match, .event, .fixture, .game, article').each((i, element) => {
      const match = {
        title: $(element).find('h3, h4, .match-title, .title').first().text().trim(),
        teams: $(element).find('.team-name, .team, .participant, .competitor').map((i, el) => $(el).text().trim()).get(),
        score: $(element).find('.score, .result, .match-score').text().trim(),
        winner: $(element).find('.winner, .champion').text().trim(),
        date: $(element).find('.date, .match-date, time, .datetime').text().trim(),
        time: $(element).find('.time, .match-time').text().trim(),
        location: $(element).find('.venue, .location, .place').text().trim(),
        category: $(element).find('.category, .division, .group').text().trim() || 
                 $(element).closest('.category-container, .group-container').find('h3, .category-title').first().text().trim()
      };
      
      // Clean up empty properties
      Object.keys(match).forEach(key => {
        if (!match[key] || (Array.isArray(match[key]) && match[key].length === 0)) {
          delete match[key];
        }
      });
      
      if (Object.keys(match).length > 1) { // At least title plus one more property
        matches.push(match);
      }
    });
    
    // Extract standings or rankings
    const standings = [];
    $('.standings, .ranking, .leaderboard, .positions, .table-standings').each((i, element) => {
      const standingData = {
        title: $(element).prev('h2, h3, h4').text().trim() || 
               $(element).find('caption, .table-title, .standings-title').text().trim() || 
               `Clasificación ${i+1}`,
        category: $(element).closest('.category-container, .group-container').find('h3, .category-title').first().text().trim(),
        teams: []
      };
      
      $(element).find('tr').each((j, row) => {
        if (j === 0) return; // Skip header row
        
        const team = {
          position: $(row).find('td:nth-child(1)').text().trim(),
          name: $(row).find('td:nth-child(2)').text().trim(),
          played: $(row).find('td:nth-child(3)').text().trim(),
          won: $(row).find('td:nth-child(4)').text().trim(),
          drawn: $(row).find('td:nth-child(5)').text().trim(),
          lost: $(row).find('td:nth-child(6)').text().trim(),
          points: $(row).find('td:nth-child(7)').text().trim() || 
                 $(row).find('td').last().text().trim()
        };
        
        // Only add if we have at least name and position
        if (team.name && team.position) {
          standingData.teams.push(team);
        }
      });
      
      if (standingData.teams.length > 0) {
        standings.push(standingData);
      }
    });
    
    // Extract medals or awards
    const medals = [];
    $('.medals, .awards, .winners').each((i, element) => {
      const medalData = {
        title: $(element).prev('h2, h3, h4').text().trim() || 
               $(element).find('caption, .table-title').text().trim() || 
               'Medallero',
        items: []
      };
      
      $(element).find('li, tr, .medal-item, .award-item').each((j, item) => {
        const medalItem = {
          position: $(item).find('.position, .medal-type, .rank').text().trim() || 
                   $(item).find('td:nth-child(1)').text().trim(),
          name: $(item).find('.name, .athlete, .winner, .team-name').text().trim() || 
                $(item).find('td:nth-child(2)').text().trim(),
          school: $(item).find('.school, .institution, .team').text().trim() || 
                 $(item).find('td:nth-child(3)').text().trim(),
          result: $(item).find('.result, .mark, .time, .score').text().trim() || 
                 $(item).find('td:nth-child(4)').text().trim()
        };
        
        // Only add if we have at least name and position
        if (medalItem.name && medalItem.position) {
          medalData.items.push(medalItem);
        }
      });
      
      if (medalData.items.length > 0) {
        medals.push(medalData);
      }
    });
    
    // Extract any news or updates specific to this sport
    const news = [];
    $('.news, .post, .update, article, .entry').each((i, element) => {
      const newsItem = {
        title: $(element).find('h2, h3, .title, .news-title, .post-title').first().text().trim(),
        date: $(element).find('.date, .posted-on, time').first().text().trim(),
        content: $(element).find('p, .content, .excerpt').first().text().trim(),
        author: $(element).find('.author, .byline').first().text().trim(),
        imageUrl: $(element).find('img').first().attr('src') || ''
      };
      
      // Clean up empty properties
      Object.keys(newsItem).forEach(key => {
        if (!newsItem[key]) {
          delete newsItem[key];
        }
      });
      
      if (newsItem.title || newsItem.content) {
        news.push(newsItem);
      }
    });
    
    // Extract gallery images if available
    const gallery = [];
    $('.gallery, .photos, .images').find('img').each((i, img) => {
      const imgSrc = $(img).attr('src') || '';
      const imgTitle = $(img).attr('alt') || $(img).attr('title') || '';
      
      if (imgSrc) {
        gallery.push({
          url: imgSrc,
          title: imgTitle,
          caption: $(img).closest('figure').find('figcaption').text().trim() || ''
        });
      }
    });
    
    const sportData = {
      sportInfo,
      results,
      matches,
      standings,
      medals,
      news,
      gallery
    };
    
    // Remove empty arrays
    Object.keys(sportData).forEach(key => {
      if (Array.isArray(sportData[key]) && sportData[key].length === 0) {
        delete sportData[key];
      }
    });
    
    // Save sport-specific data to file
    const filename = `${sport.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    await saveToFile(filename, sportData);
    return sportData;
  } catch (error) {
    console.error(`Error scraping ${sport.name} page: ${error.message}`);
    return {
      sportInfo: {
        name: sport.name,
        url: sportUrl,
        error: error.message
      }
    };
  }
}

// Main function to run the scraper
async function runScraper() {
  console.log('Starting enhanced web scraper for Juegos Nacionales Salesianos 2025');
  console.log(`Output directory: ${CONFIG.outputDir}`);
  
  try {
    // Ensure output directory exists
    await ensureDirectoryExists(CONFIG.outputDir);
    
    // Create log file and start logging
    const logFile = path.join(CONFIG.outputDir, 'scraping_log.txt');
    const logEntry = `Scraping started at: ${new Date().toISOString()}\n`;
    await writeFileAsync(logFile, logEntry, { flag: 'a' });
    
    // Scrape main page
    const mainPageData = await scrapeMainPage();
    await delay(CONFIG.requestDelay);
    
    // Scrape each sport discipline
    const sportsData = {};
    for (const sport of SPORTS) {
      sportsData[sport.name] = await scrapeSportPage(sport);
      // Add a delay between requests to be respectful to the server
      await delay(CONFIG.requestDelay);
    }
    
    // Save combined data
    const allData = {
      mainPage: mainPageData,
      sports: sportsData,
      metadata: {
        scrapedAt: new Date().toISOString(),
        version: '1.0.0',
        config: {
          baseUrl: CONFIG.baseUrl,
          sportsScraped: SPORTS.map(s => s.name)
        }
      }
    };
    
    await saveToFile('all_data.json', allData);
    
    // Create a summary file with key information
    const summary = {
      eventTitle: mainPageData?.generalInfo?.title || 'Juegos Nacionales Salesianos 2025',
      lastUpdated: new Date().toISOString(),
      sports: Object.keys(sportsData).map(sportName => {
        const sport = sportsData[sportName];
        return {
          name: sportName,
          resultsCount: sport?.results?.length || 0,
          matchesCount: sport?.matches?.length || 0,
          hasStandings: !!sport?.standings?.length,
          hasMedals: !!sport?.medals?.length,
          error: sport?.sportInfo?.error
        };
      })
    };
    
    await saveToFile('summary.json', summary);
    
    // Update log
    const completionLog = `Scraping completed at: ${new Date().toISOString()}\n` +
                          `Total sports scraped: ${Object.keys(sportsData).length}\n` +
                          `Results saved to: ${CONFIG.outputDir}\n\n`;
    await writeFileAsync(logFile, completionLog, { flag: 'a' });
    
    console.log('Web scraping completed successfully!');
    return summary;
  } catch (error) {
    console.error('Fatal error in the scraping process:', error);
    
    // Log error
    const errorLog = `ERROR at ${new Date().toISOString()}: ${error.message}\n${error.stack}\n\n`;
    const logFile = path.join(CONFIG.outputDir, 'scraping_log.txt');
    await writeFileAsync(logFile, errorLog, { flag: 'a' });
    
    throw error;
  }
}

// Direct execution
if (require.main === module) {
  runScraper()
    .then(() => {
      console.log('Scraping process completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping process failed with error:', error);
      process.exit(1);
    });
} else {
  // Export functions for use as a module
  module.exports = {
    runScraper,
    scrapeMainPage,
    scrapeSportPage,
    CONFIG,
    SPORTS
  };
}
