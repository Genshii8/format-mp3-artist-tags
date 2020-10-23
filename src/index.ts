import mri from "mri"
import fs from "fs"
import readline from "readline"
import id3, { update } from "node-id3"

const argv = process.argv.slice(2)
const options = mri(argv)
const updateFiles = options.u

const unprocessedPath = "unprocessed/"
const processedPath = "processed/"

const artistRegex = new RegExp(/(.+?)[,&x] (.+)/)
const featRegex = new RegExp(/(.+)( feat | feat\. )(.+)/i)

fs.writeFileSync("output.txt", "")

async function run() {
  const ignoreList = await getIgnoreList()

  const files = fs.readdirSync(unprocessedPath)

  for (const file of files) {
    const tags = id3.read(unprocessedPath + file)

    if (!tags.artist) {
      console.log(`"${file}" has no artist.`)
      continue
    }

    const featMatch = tags.artist.match(featRegex)

    if (!featMatch) {
      const match = tags.artist.match(artistRegex)

      if (!match) {
        console.log(`Skipping "${file}". It only has one artist.`)
        continue
      }

      const remainingArtists = `${match[1]}, ${match[2]}`
      updateTags(file, remainingArtists, ignoreList)

      continue
    }

    const remainingArtists = `${featMatch[1]}, ${featMatch[3]}`
    updateTags(file, remainingArtists, ignoreList)
  }
}

function updateTags(file: string, remainingArtists: string, ignoreList: string[]) {
  if (shouldIgnore(remainingArtists, ignoreList)) {
    console.log(`Skipping "${file}". It contains an artist in your ignore list.`)
    return
  }

  const inputPath = unprocessedPath + file
  const outputPath = processedPath + file

  const before = id3.read(inputPath).artist
  const artists = processArtists(remainingArtists)
  const tags = { artist: artists }

  fs.appendFileSync("output.txt", `${before} -> ${artists}\n\n`)

  if (updateFiles) {
    id3.update(tags, inputPath)

    fs.rename(inputPath, outputPath, (err) => {
      if (err) throw err
    })
  }
}

function processArtists(remainingArtists: string) {
  let artists = ""

  while (true) {
    let artist = remainingArtists.match(artistRegex)

    if (!artist) {
      artist = remainingArtists.match(/.+/)

      if (!artist) {
        break
      }

      artists = artists.concat("", `${artist[0].trim()};`)

      break
    }

    artists = artists.concat("", `${artist[1].trim()}; `)
    remainingArtists = artist[2]
  }

  return artists
}

async function getIgnoreList(): Promise<string[]> {
  const ignore: string[] = []
  const fileStream = fs.createReadStream("ignore.txt")

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    ignore.push(line)
  }

  return ignore
}

function shouldIgnore(remainingArtists: string, ignoreList: string[]) {
  let shouldIgnore = false

  for (const ignore of ignoreList) {
    if (remainingArtists.includes(ignore)) {
      shouldIgnore = true
      break
    }
  }

  return shouldIgnore
}

run()
