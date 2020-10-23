import mri from "mri"
import fs from "fs"
import readline from "readline"
import id3 from "node-id3"

const argv = process.argv.slice(2)
const options = mri(argv)
const updateFiles = options.u

const unprocessedPath = "app/unprocessed/"
const processedPath = "app/processed/"
const ignoredPath = "app/ignored/"
const changesFilePath = "app/changes.txt"

const artistRegex = new RegExp(/(.+?)( [&x] |, | and )(.+)/i)
const featRegex = new RegExp(/(.+)( featuring | feat | feat\. | ft | ft\. )(.+)/i)

fs.writeFileSync(changesFilePath, "")

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

      updateTags(file, match, ignoreList, artist)

      continue
    }

    updateTags(file, featMatch, ignoreList, artist)
  }
}

function updateTags(file: string, match: RegExpMatchArray, ignoreList: string[], artist: string) {
  const inFilePath = unprocessedPath + file
  const outFilePath = processedPath + file
  const ignoredFilePath = ignoredPath + file

  if (shouldIgnore(ignoreList, artist)) {
    console.log(`Skipping "${file}". It contains an artist in your ignore list.`)

    fs.rename(inFilePath, ignoredFilePath, (err) => {
      if (err) throw err
    })
    return
  }

  const remainingArtists = `${match[1]}, ${match[3]}`
  const artists = processArtists(remainingArtists)
  const tags = { artist: artists }

  fs.appendFileSync(changesFilePath, `${artist} -> ${artists}\n\n`)

  if (updateFiles) {
    id3.update(tags, inFilePath)

    fs.rename(inFilePath, outFilePath, (err) => {
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
