import mri from "mri"
import fs from "fs"
import readline from "readline"
import id3 from "node-id3"

const argv = process.argv.slice(2)
const options = mri(argv)
const updateFiles = options.u

const unprocessedPath = "app/unprocessed/"
const processedPath = "app/processed/"
const changesPath = "app/changes.txt"

const artistRegex = new RegExp(/(.+?)[,&x] (.+)/)
const featRegex = new RegExp(/(.+)( feat | feat\. )(.+)/i)

fs.writeFileSync(changesPath, "")

async function run() {
  const ignoreList = await getIgnoreList()

  const files = fs.readdirSync(unprocessedPath)

  for (const file of files) {
    if (file == ".keep") continue

    const artist = id3.read(unprocessedPath + file).artist

    if (!artist) {
      console.log(`"${file}" has no artist.`)
      continue
    }

    const featMatch = artist.match(featRegex)

    if (!featMatch) {
      const match = artist.match(artistRegex)

      if (!match) {
        console.log(`Skipping "${file}". It only has one artist: ${artist}`)
        continue
      }

      const remainingArtists = `${match[1]}, ${match[2]}`
      updateTags(file, remainingArtists, ignoreList, artist)

      continue
    }

    const remainingArtists = `${featMatch[1]}, ${featMatch[3]}`
    updateTags(file, remainingArtists, ignoreList, artist)
  }
}

function updateTags(file: string, remainingArtists: string, ignoreList: string[], artist: string) {
  if (shouldIgnore(ignoreList, artist)) {
    console.log(`Skipping "${file}". It contains an artist in your ignore list.`)
    return
  }

  const inputPath = unprocessedPath + file
  const outputPath = processedPath + file

  const artists = processArtists(remainingArtists)
  const tags = { artist: artists }

  fs.appendFileSync(changesPath, `${artist} -> ${artists}\n\n`)

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
    let match = remainingArtists.match(artistRegex)

    if (!match) {
      match = remainingArtists.match(/.+/)

      if (!match) {
        break
      }

      artists = artists.concat("", `${match[0].trim()};`)

      break
    }

    artists = artists.concat("", `${match[1].trim()}; `)
    remainingArtists = match[2]
  }

  return artists
}

async function getIgnoreList(): Promise<string[]> {
  const ignore: string[] = []
  const fileStream = fs.createReadStream("app/ignore.txt")

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

run()
