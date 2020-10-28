import mri from "mri"
import fs from "fs-extra"
import fsPromises from "fs/promises"
import walk from "walk-sync"
import readline from "readline"
import path from "path"
import id3 from "node-id3"

//update readme

const mriOptions = {
  alias: {
    t: "test",
    i: "input",
    o: "output",
    u: "update",
    s: "stay",
    m: "move",
    a: "ignore-slash",
    h: "help",
  },
  boolean: ["t", "u", "s", "m", "a", "h"],
}
const options = mri(process.argv.slice(2), mriOptions)

const baseDir = "app"
const baseInputDir = `${baseDir}/files/`
const baseOutputDir = `${baseDir}/processed/`

const inputDir = path.posix.normalize(
  (options.i === true && baseInputDir) || (options.i ?? baseInputDir) + "/"
)
const outputDir = path.posix.normalize(
  (options.o === true && `${inputDir}../processed/`) || (options.o ?? baseOutputDir) + "/"
)
const ignoredDir = path.posix.normalize(`${inputDir}../ignored/`)
const changesFile = `${baseDir}/changes.txt`
const ignoreFile = `${baseDir}/ignore.txt`
const testFiles = "test_files/"

const artistRegex = new RegExp(/(.+?)( [&x×+,] |, | and )(.+)/i)
const featRegex = new RegExp(/(.+)( featuring | feat | feat\. | ft | ft\. )(.+)/i)

const ignored: string[] = []

if (options.t) test()

fs.ensureFileSync(`${baseInputDir}.keep`)
fs.ensureFileSync(ignoreFile)
fs.outputFileSync(changesFile, "")

run()

async function run() {
  if (options.h) {
    printHelp()
    return
  }

  const ignoreList = await getIgnoreList()

  const noArtist: string[] = []

  const files = walk(inputDir, { directories: false })

  for (const filePath of files) {
    const file = {
      fileName: path.posix.basename(filePath),
      inputFile: inputDir + filePath,
      outputFile: outputDir + filePath,
      ignoredFile: ignoredDir + filePath,
    }

    if (file.fileName == ".keep") continue

    const artist = id3.read(file.inputFile).artist

    if (!artist) {
      noArtist.push(`"${file.fileName}" has no artist.`)
      continue
    }

    const featMatch = artist.match(featRegex)

    if (!featMatch) {
      const match = artist.match(artistRegex)

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

  await removeEmptyDirectories(inputDir)

  for (const message of noArtist) {
    console.log(message)
  }

  for (const message of ignored) {
    console.log(message)
  }
}

function updateTags(
  file: Record<string, string>,
  match: RegExpMatchArray,
  ignoreList: string[],
  artist: string
) {
  if (shouldIgnore(ignoreList, artist)) {
    ignored.push(
      `Skipping "${file.fileName}". It contains an artist in your ignore list: ${artist}`
    )

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
  let artists = ""

  if (shouldRemoveSlashFromArtist(remainingArtists))
    remainingArtists = removeSlash(remainingArtists)

  while (true) {
    let match = remainingArtists.match(artistRegex)

    if (!match) {
      match = remainingArtists.match(/.+/)

      if (!match) {
        break
      }

      const artist = match[0].trim()
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
  return artist.includes("/")
}

function removeSlash(artist: string) {
  return (artist = artist.replace(/\//g, ""))
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
    const recursiveRemovalPromises = fileNames.map((fileName) =>
      removeEmptyDirectories(path.posix.join(directory, fileName))
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

function printHelp() {
  console.log(`
  Options:

  -i, --input <path>    specify a folder that contains your input files
  -o, --output <path>   specify a folder where processed files will be moved to
  -u, --update          apply changes to files
  -s, --stay            don't move files after processing (including ignored files)
  -m, --move            move all files to output directory (including ignored files)
  -a, --ignore-slash    ignore files where artists have a slash in their name so they can be handled manually
  -t, --test            copy test_files to input directory
  `)
}
