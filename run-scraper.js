#!/usr/bin/env node
const { runScraper } = require('./enhanced-scraper');
const { processAllSportsData, CONFIG } = require('./data-processor');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Define available commands
const COMMANDS = {
  SCRAPE: 'scrape',
  PROCESS: 'process',
  BOTH: 'both',
  HELP: 'help',
  EXIT: 'exit'
};

// Display the welcome message
function displayWelcome() {
  console.log(`
============================================================
    JUEGOS NACIONALES SALESIANOS 2025 - WEB SCRAPER
============================================================

Este script permite extraer y procesar los resultados deportivos
del sitio web de los Juegos Nacionales Salesianos 2025.

Comandos disponibles:
  ${COMMANDS.SCRAPE}   - Solo extraer datos del sitio web
  ${COMMANDS.PROCESS}  - Solo procesar datos ya extraídos
  ${COMMANDS.BOTH}     - Extraer y procesar datos
  ${COMMANDS.HELP}     - Mostrar esta ayuda
  ${COMMANDS.EXIT}     - Salir del programa

Desarrollado para: Juegos Nacionales Salesianos 2025
Fecha: ${new Date().toLocaleDateString('es-ES')}
  `);
}

// Display help message
function displayHelp() {
  console.log(`
Instrucciones de uso:
---------------------

1. ${COMMANDS.SCRAPE}:
   Extrae los datos del sitio web y los guarda en formato JSON
   en el directorio: ${CONFIG.dataDir}

2. ${COMMANDS.PROCESS}:
   Procesa los datos previamente extraídos y genera reportes
   en formato HTML y CSV en el directorio: ${CONFIG.reportsDir}

3. ${COMMANDS.BOTH}:
   Ejecuta ambas operaciones en secuencia (extracción y procesamiento)

4. ${COMMANDS.HELP}:
   Muestra este mensaje de ayuda

5. ${COMMANDS.EXIT}:
   Sale del programa

Nota: Para visualizar los resultados, abra el archivo index.html
      del directorio de reportes en su navegador web.
  `);
}

// Check if data directory exists and has files
function checkDataExists() {
  try {
    if (!fs.existsSync(CONFIG.dataDir)) {
      return false;
    }
    
    const files = fs.readdirSync(CONFIG.dataDir);
    return files.some(file => file.endsWith('.json'));
  } catch (error) {
    console.error('Error checking data directory:', error.message);
    return false;
  }
}

// Run the scraper
async function runScraperCommand() {
  console.log('\nIniciando extracción de datos...\n');
  
  try {
    const startTime = Date.now();
    await runScraper();
    const endTime = Date.now();
    
    console.log(`\nExtracción de datos completada en ${((endTime - startTime) / 1000).toFixed(2)} segundos.`);
    console.log(`Los datos han sido guardados en: ${CONFIG.dataDir}`);
    
    return true;
  } catch (error) {
    console.error('\nError durante la extracción de datos:', error.message);
    return false;
  }
}

// Process the data
async function processDataCommand() {
  if (!checkDataExists()) {
    console.log(`\n⚠️ No se encontraron datos para procesar en ${CONFIG.dataDir}`);
    console.log('   Ejecute primero el comando "scrape" para extraer los datos.\n');
    return false;
  }
  
  console.log('\nIniciando procesamiento de datos...\n');
  
  try {
    const startTime = Date.now();
    await processAllSportsData();
    const endTime = Date.now();
    
    console.log(`\nProcesamiento de datos completado en ${((endTime - startTime) / 1000).toFixed(2)} segundos.`);
    console.log(`Los reportes han sido guardados en: ${CONFIG.reportsDir}`);
    console.log(`Abra ${path.join(CONFIG.reportsDir, 'index.html')} en su navegador para ver los resultados.`);
    
    return true;
  } catch (error) {
    console.error('\nError durante el procesamiento de datos:', error.message);
    return false;
  }
}

// Run both scraper and processor
async function runBothCommand() {
  const scrapeSuccess = await runScraperCommand();
  if (!scrapeSuccess) {
    return false;
  }
  
  console.log('\n---------------------------------------------\n');
  
  const processSuccess = await processDataCommand();
  if (!processSuccess) {
    return false;
  }
  
  return true;
}

// Process command input
async function processCommand(command) {
  switch (command.toLowerCase()) {
    case COMMANDS.SCRAPE:
      return await runScraperCommand();
      
    case COMMANDS.PROCESS:
      return await processDataCommand();
      
    case COMMANDS.BOTH:
      return await runBothCommand();
      
    case COMMANDS.HELP:
      displayHelp();
      return true;
      
    case COMMANDS.EXIT:
      console.log('\n¡Hasta luego! Gracias por usar el scraper.\n');
      rl.close();
      process.exit(0);
      
    default:
      console.log(`\nComando no reconocido: "${command}"`);
      console.log(`Use "${COMMANDS.HELP}" para ver los comandos disponibles.\n`);
      return false;
  }
}

// Main CLI loop
async function startCLI() {
  displayWelcome();
  
  // Process command line arguments if any
  const args = process.argv.slice(2);
  if (args.length > 0) {
    await processCommand(args[0]);
    rl.close();
    return;
  }
  
  // Interactive mode
  promptUser();
  
  function promptUser() {
    rl.question('\nIngrese un comando (help para ayuda): ', async (command) => {
      if (command.toLowerCase() === COMMANDS.EXIT) {
        console.log('\n¡Hasta luego! Gracias por usar el scraper.\n');
        rl.close();
        return;
      }
      
      await processCommand(command);
      promptUser(); // Continue prompting
    });
  }
}

// Start the CLI if this script is run directly
if (require.main === module) {
  startCLI().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
}
