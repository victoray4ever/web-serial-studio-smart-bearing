const fs = require('fs');

const [projectPath, backupPath] = process.argv.slice(2);
if (!projectPath || !backupPath) throw new Error('Project and backup paths are required');

const original = fs.readFileSync(projectPath, 'utf8');
const project = JSON.parse(original);

if (!String(project.sources?.[0]?.frameParserCode || '').includes('gatewayWrapped')) {
  throw new Error('Expected gateway-compatible mixed parser was not found');
}

fs.copyFileSync(projectPath, backupPath);

project.frameStart = '5A A5';
project.frameEnd = 'DD EE';
project.frameDetection = 'StartAndEndDelimiter';
project.hexadecimalDelimiters = true;

if (!project.protocolSchema || typeof project.protocolSchema !== 'object') {
  project.protocolSchema = {};
}
project.protocolSchema.frameStart = '5A A5';
project.protocolSchema.frameEnd = 'DD EE';
project.protocolSchema.frameDetection = 'StartAndEndDelimiter';
project.protocolSchema.hexadecimalDelimiters = true;

fs.writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  projectPath,
  backupPath,
  frameDetection: project.frameDetection,
  schemaFrameDetection: project.protocolSchema.frameDetection
}));
