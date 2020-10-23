# mp3-fix-artist-tags

Changes artist tags on mp3 files (or anything with ID3 tags) to the "proper" format when there are multiple artists.

Music apps will often list the same artist as a seperate artist if a particular track has multiple artists. For example, say you have a track by `Artist 1` and another track by `Artist 1 & Artist 2`. If you wanted to look at all the tracks by `Artist 1`, the track by `Artist 1 & Artist 2` wouldn't show up and would be under its own artist entry.

This app fixes that by changing the artist tag to a list of artists seperated by semicolons. e.g. `Artist 1; Artist 2`.

## Installation

1. Clone the repo.

```
git clone git@github.com:adamhl8/mp3-fix-artist-tags.git
```

2. Install dependencies.

```
yarn install
```

## Usage

This app assumes artists will be seperated by a `,`, `&`, or `x`. It also grabs any `feat.` artists.

```
Artist 1, Artist 2 & Artist 3 x Artist 4 feat. Artist 5, Artist 6
->
Artist 1; Artist 2; Artist 3; Artist 4; Artist 5; Artist 6
```

### "app" folder

Place files to be processed into `unprocessed`.

Files will be moved to `processed` after being updated.

#### changes.txt

After running the app, view this file to see what changes are being made to artist tags. That way you can make sure the tags are being changed properly.

#### ignore.txt

Use this if you want to skip files by certain artists. This is primarly used for artists that have parts of their name seperated by `,`, `&`, or `x`. If a file contains *any* artist in `ignore.txt`, it will be skipped completely. Place each artist on its own line.

```
// ignore.txt

Ar & Tist
Tist x Ar
```

### Run the app

1. Generate list of changes. Running the app without the `-u` flag will not make any changes to your files.

```
yarn start
```

2. Apply changes.

```
yarn start -u
```

Any skipped files will remain in `unprocessed` where you can handle them manually.