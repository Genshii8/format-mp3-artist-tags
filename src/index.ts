import fs from "fs"
import id3 from "node-id3"

const files = fs.readdirSync("unprocessed")

const artistRegex = new RegExp(/(.+?)[,&x] (.+)/)
const featRegex = new RegExp(/(.+)( feat | feat\. )(.+)/i)

for (const file of files) {
  const tags = id3.read("unprocessed/" + file)

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

    const artists = processArtists(`${match[1]}, ${match[2]}`)
    console.log(artists)

    continue
  }

  const artists = processArtists(`${featMatch[1]}, ${featMatch[3]}`)
  console.log(artists)
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
