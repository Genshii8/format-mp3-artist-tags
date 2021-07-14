import fs from 'fs-extra'
// eslint-disable-next-line unicorn/prefer-node-protocol
import fsPromises from 'fs/promises'
import mri from 'mri'
import id3 from 'node-id3'
// eslint-disable-next-line unicorn/prefer-node-protocol
import path from 'path'
// eslint-disable-next-line unicorn/prefer-node-protocol
import readline from 'readline'
import walk from 'walk-sync'

const mriOptions = {
  alias: {
    t: 'test',
    i: 'input',
    o: 'output',
    u: 'update',
    s: 'stay',
    m: 'move',
    a: 'ignore-slash',
    h: 'help',
  },
  boolean: ['t', 'u', 's', 'm', 'a', 'h'],
}
const options = mri(process.argv.slice(2), mriOptions)

const baseDirectory = 'app'
const baseInputDirectory = `${baseDirectory}/files/`
const baseOutputDirectory = `${baseDirectory}/processed/`

const inputDirectory = path.posix.normalize(
  (options.i === true && baseInputDirectory) || `${(options.i as string) ?? baseInputDirectory}/`,
)

const outputDirectory = path.posix.normalize(
  (options.o === true && `${inputDirectory}../processed/`) || `${(options.o as string) ?? baseOutputDirectory}/`,
)
const ignoredDirectory = path.posix.normalize(`${inputDirectory}../ignored/`)
const changesFile = `${baseDirectory}/changes.txt`
const ignoreFile = `${baseDirectory}/ignore.txt`
const testFiles = 'test_files/'

const artistRegex = new RegExp(/(.+?)( [&+,x×] |, | and | with )(.+)/i)
const featRegex = new RegExp(/(.+)( featuring | feat | feat\. | ft | ft\. )(.+)/i)

const ignored: string[] = []

if (options.t) test()

fs.ensureFileSync(`${baseInputDirectory}.keep`)
fs.ensureFileSync(ignoreFile)
fs.outputFileSync(changesFile, '')

async function main() {
  if (options.h) {
    printHelp()
    return
  }

  const files = walk(inputDirectory, { directories: false })
  const ignoreList = await getIgnoreList()

  const noArtist = handleFiles(files, ignoreList)

  await removeEmptyDirectories(inputDirectory)

  for (const message of noArtist) {
    console.log(message)
  }

  for (const message of ignored) {
    console.log(message)
  }
}

function handleFiles(files: string[], ignoreList: string[]) {
  const noArtist: string[] = []

  for (const filePath of files) {
    const file = {
      fileName: path.posix.basename(filePath),
      inputFile: inputDirectory + filePath,
      outputFile: outputDirectory + filePath,
      ignoredFile: ignoredDirectory + filePath,
    }

    if (file.fileName === '.keep') continue

    const artist = id3.read(file.inputFile).artist

    if (!artist) {
      noArtist.push(`"${file.fileName}" has no artist.`)
      continue
    }

    const featMatch = featRegex.exec(artist)

    if (!featMatch) {
      const match = artistRegex.exec(artist)

      if (!match) {
        console.log(`Skipping "${file.fileName}". It only has one artist: ${artist}`)
        if (options.u && !options.s) fs.moveSync(file.inputFile, file.outputFile)
        continue
      }

      updateTags(file, match, ignoreList, artist)

      continue
    }

    updateTags(file, featMatch, ignoreList, artist)
  }

  return noArtist
}

function updateTags(file: Record<string, string>, match: RegExpMatchArray, ignoreList: string[], artist: string) {
  if (shouldIgnore(ignoreList, artist)) {
    ignored.push(`Skipping "${file.fileName}". It contains an artist in your ignore list: ${artist}`)

    if (options.u && !options.s && options.m) {
      fs.moveSync(file.inputFile, file.outputFile)
    } else if (options.u && !options.s) {
      fs.moveSync(file.inputFile, file.ignoredFile)
    }

    return
  }

  const remainingArtists = `${match[1]}, ${match[3]}`
  const artists = processArtists(remainingArtists)
  const tags = { artist: artists }

  fs.appendFileSync(changesFile, `${artist} -> ${artists}\n\n`)

  if (options.u) {
    id3.update(tags, file.inputFile)

    if (!options.s) fs.moveSync(file.inputFile, file.outputFile)
  }
}

function processArtists(remainingArtists: string) {
  let artists = ''

  if (shouldRemoveSlashFromArtist(remainingArtists)) remainingArtists = removeSlash(remainingArtists)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = artistRegex.exec(remainingArtists)

    if (!match) {
      const matchRemainingArtist = /.+/.exec(remainingArtists)

      if (!matchRemainingArtist) break

      const artist = matchRemainingArtist[0].trim()
      artists += artist

      break
    }

    const artist = match[1].trim()
    artists += `${artist}/`

    remainingArtists = match[3]
  }

  return artists
}

function shouldRemoveSlashFromArtist(artist: string) {
  return artist.includes('/')
}

function removeSlash(artist: string) {
  artist = artist.replace(/\//g, '')
  return artist
}

async function getIgnoreList(): Promise<string[]> {
  const ignore: string[] = []
  const fileStream = fs.createReadStream(ignoreFile)

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of rl) {
    ignore.push(line)
  }

  return ignore
}

function shouldIgnore(ignoreList: string[], artist: string) {
  for (const ignore of ignoreList) {
    if (artist.toLowerCase().includes(ignore.toLowerCase())) {
      return true
    }
  }

  if (options.a && shouldRemoveSlashFromArtist(artist)) return true

  return false
}

async function removeEmptyDirectories(directory: string) {
  const fileStats = await fsPromises.lstat(directory)
  if (!fileStats.isDirectory()) {
    return
  }

  let fileNames = await fsPromises.readdir(directory)
  if (fileNames.length > 0) {
    const recursiveRemovalPromises = fileNames.map(async (fileName) =>
      removeEmptyDirectories(path.posix.join(directory, fileName)),
    )
    await Promise.all(recursiveRemovalPromises)

    // Re-evaluate fileNames; after deleting subdirectory
    // we may have parent directory empty now
    fileNames = await fsPromises.readdir(directory)
  }

  if (fileNames.length === 0) {
    await fsPromises.rmdir(directory)
  }
}

function test() {
  fs.emptyDirSync(inputDirectory)
  fs.emptyDirSync(outputDirectory)
  fs.emptyDirSync(ignoredDirectory)
  fs.outputFileSync(ignoreFile, 'Ignore')
  fs.copySync(testFiles, inputDirectory)
}

function printHelp() {
  console.log(`
  Options:

  -i, --input <path>    specify a folder that contains your input files
  -o, --output <path>   specify a folder where processed files will be moved to
  -u, --update          apply changes to files
  -s, --stay            don't move files after processing (including ignored files)
  -m, --move            move all files to output directory (including ignored files)
  -a, --ignore-slash    ignore files where artists have a slash in their name
  -t, --test            copy test_files to input directory
  -h, --help            output options
  `)
}

void main()
