import fs from "fs"
import id3 from "node-id3"
import mri from "mri"

const argv = process.argv.slice(2)
const options = mri(argv, {
  boolean: "noFeat",
  default: {
    noFeat: false,
  },
})

const noFeat = options.noFeat

const files = fs.readdirSync("unprocessed")

const artistRegex = new RegExp(/(.+?)[,&x] (.+)/)
const featRegex = new RegExp(/(.+)( feat | feat\. )(.+)/)

for (const file of files) {
  const tags = id3.read("unprocessed/" + file)

  if (!tags.artist) {
    console.log(`${file} has no artist.`)
    continue
  }

  const match = tags.artist.match(artistRegex)

  if (!match) {
    const featMatch = tags.artist.match(featRegex)

    if (!featMatch || noFeat) {
      console.log(`Skipping "${file}". It only has one artist.`)
      continue
    }

    const artists = processArtists(featMatch)
    console.log(artists)

    continue
  }

  const artists = processArtists(match)
  console.log(artists)
}

function processArtists(match: RegExpMatchArray) {
  let artists = match[1].trim().concat("", "; ")
  let remainingArtists = match[2]

  if (remainingArtists == " feat " || remainingArtists == " feat. ") {
    remainingArtists = match[3]
  }

  while (true) {
    let artist = remainingArtists.match(artistRegex)

    if (!artist || remainingArtists.match(featRegex)) {

      artist = remainingArtists.match(featRegex)

      if (!artist) {

        if (noFeat) {
          break
        }

        artist = remainingArtists.match(/.+/)

        if (!artist) {
          break
        }

        artists = artists.concat("", `${artist[0].trim()};`)

        break
      }

      artists = artists.concat("", `${artist[1].trim()}; `)
      remainingArtists = artist[3]

      continue
    }

    artists = artists.concat("", `${artist[1].trim()}; `)
    remainingArtists = artist[2]
  }

  return artists
}
