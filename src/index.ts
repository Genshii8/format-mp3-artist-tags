import mri from "mri"
import fs from "fs-extra"
import fsPromises from "fs/promises"
import walk from "walk-sync"
import readline from "readline"
import path from "path"
import id3 from "node-id3"


// flag for editing in-place
// ignore files with slash or define separator
// fix test files
//update readme

const mriOptions = {
  alias: {
    i: "input",
    o: "output",
    u: "update",
    t: "test"
  },
}
const options = mri(process.argv.slice(2), mriOptions)

const baseDir = "app"
const baseInputDir = `${baseDir}/files/`
const baseOutputDir = `${baseDir}/processed/`

const inputDir = path.normalize((options.i ?? baseInputDir) + "/")
const outputDir =
  path.normalize((options.o === true && `${inputDir}../processed/`) || (options.o ?? baseOutputDir) + "/")
const ignoredDir = path.normalize(`${inputDir}../ignored/`)

const changesFile = `${baseDir}/changes.txt`
const ignoreFile = `${baseDir}/ignore.txt`
const testFiles = "test_files/"

const artistRegex = new RegExp(/(.+?)( [&x] |, | and )(.+)/i)
const featRegex = new RegExp(/(.+)( featuring | feat | feat\. | ft | ft\. )(.+)/i)

setup()

if (options.t) test()

run()

async function run() {
  const ignoreList = await getIgnoreList()

  const files = walk(inputDir, { directories: false })

  for (const filePath of files) {
    const inputFile = inputDir + filePath
    const fileName = path.posix.basename(filePath)

    if (fileName == ".keep") continue

    const artist = id3.read(inputFile).artist

    if (!artist) {
      console.log(`"${fileName}" has no artist.`)
      continue
    }

    const featMatch = artist.match(featRegex)

    if (!featMatch) {
      const match = artist.match(artistRegex)

      if (!match) {
        console.log(`Skipping "${fileName}". It only has one artist: ${artist}`)
        continue
      }

      updateTags(filePath, inputFile, fileName, match, ignoreList, artist)

      continue
    }

    updateTags(filePath, inputFile, fileName, featMatch, ignoreList, artist)
  }

  await removeEmptyDirectories(inputDir)
}

function updateTags(
  filePath: string,
  inputFile: string,
  fileName: string,
  match: RegExpMatchArray,
  ignoreList: string[],
  artist: string
) {
  const outputFile = outputDir + filePath
  const ignoredFile = ignoredDir + filePath

  if (shouldIgnore(ignoreList, artist)) {
    console.log(`Skipping "${fileName}". It contains an artist in your ignore list.`)

    fs.moveSync(inputFile, ignoredFile)
    return
  }

  const remainingArtists = `${match[1]}, ${match[3]}`
  const artists = processArtists(remainingArtists)
  const tags = { artist: artists }

  fs.appendFileSync(changesFile, `${artist} -> ${artists}\n\n`)

  if (options.u) {
    id3.update(tags, inputFile)

    fs.moveSync(inputFile, outputFile)
  }
}

function processArtists(remainingArtists: string) {
  let artists = ""

  while (true) {
    let match = remainingArtists.match(artistRegex)

    if (!match) {
      match = remainingArtists.match(/.+/)

      if (!match) {
        break
      }

      const artist = match[0].trim()
      artists += removeSlashFromArtist(artist)

      break
    }

    const artist = match[1].trim()
    artists += `${removeSlashFromArtist(artist)}/`

    remainingArtists = match[3]
  }

  return artists
}

function removeSlashFromArtist(artist: string) {
  if (artist.includes("/")) {
    return (artist = artist.replace(/\//g, ""))
  }

  return artist
}

async function getIgnoreList(): Promise<string[]> {
  const ignore: string[] = []
  const fileStream = fs.createReadStream(ignoreFile)

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    ignore.push(line)
  }

  return ignore
}

function shouldIgnore(ignoreList: string[], artists: string) {
  for (const ignore of ignoreList) {
    if (artists.toLowerCase().includes(ignore.toLowerCase())) {
      return true
    }
  }

  return false
}

async function removeEmptyDirectories(directory: string) {

  const fileStats = await fsPromises.lstat(directory)
  if (!fileStats.isDirectory()) {
    return
  }
  let fileNames = await fsPromises.readdir(directory)
  if (fileNames.length > 0) {
    const recursiveRemovalPromises = fileNames.map((fileName) =>
      removeEmptyDirectories(path.join(directory, fileName))
    )
    await Promise.all(recursiveRemovalPromises)

    // re-evaluate fileNames; after deleting subdirectory
    // we may have parent directory empty now
    fileNames = await fsPromises.readdir(directory)
  }

  if (fileNames.length === 0) {
    await fsPromises.rmdir(directory)
  }
}

function test() {
  fs.emptyDirSync(inputDir)
  fs.emptyDirSync(outputDir)
  fs.emptyDirSync(ignoredDir)
  fs.outputFileSync(ignoreFile, "Ignore")
  fs.copySync(testFiles, inputDir)
}

function setup() {
  fs.ensureFileSync(`${baseInputDir}.keep`)
  fs.ensureFileSync(ignoreFile)
  fs.outputFileSync(changesFile, "")
}
