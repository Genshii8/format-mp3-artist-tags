# format-mp3-artist-tags

Changes artist tags in bulk on mp3 files (or anything with ID3 tags) to the "proper" format when there are multiple artists.

Music apps will often list the same artist as a separate artist if a particular track has multiple artists. For example, say you have a track by `Artist 1` and another track by `Artist 1 & Artist 2`. If you wanted to look at all the tracks by `Artist 1`, the track by `Artist 1 & Artist 2` wouldn't show up and would be under its own artist entry.

This app fixes that by changing the artist tag to a list of artists seperated by forward slashes. e.g. `Artist 1/Artist 2`.

## Installation

1. Clone the repo.

```
git clone https://github.com/adamhl8/mp3-fix-artist-tags.git
```

2. Install dependencies.

```
yarn install
```

3. Build the app.

```
yarn launch
```

## Usage

### Run the app

1. Place files to be processed in "format-mp3-artist-tags/app/files". (Please see below for the available command line options.)

2. Generate list of changes ("changes.txt") and view the file to make sure everything is good to go or if anything needs to be ignored. Running the app without the `-u` flag will not make any changes to or move your files.

```
yarn start
```

3. Apply changes.

```
yarn start -u
```

### "app" folder

Place files to be processed into `files`.

Files are moved to `processed` after being updated or skipped.

Ignored files are moved to `ignored`.

#### changes.txt

After running the app, view this file to see what changes are going to being made to the artist tags. That way you can make sure the tags are being changed properly.

#### ignore.txt

Use this if you want to ignore files by certain artists. This is primarily used for artists that have parts of their name separated by one of the characters listed above. If a file contains _any_ artist in `ignore.txt`, it will be ignored completely. Place each artist on its own line.

```
// ignore.txt

Ar & tist
Ts x itra
```

### Options

```
Options:

  -i, --input <path>    specify a folder that contains your input files
  -o, --output <path>   specify a folder where processed files will be moved to
  -u, --update          apply changes to files
  -s, --stay            don't move files after processing (including ignored files)
  -m, --move            move all files to output directory (including ignored files)
  -a, --ignore-slash    ignore files where artists have a slash in their name
  -t, --test            copy test_files to input directory
  -h, --help            output options
```

Generally speaking, if you want to specify an input directory, the command you run will look something like this:
`yarn start -i /path/to/directory/ -o -u`

Some notes about how this app functions:

- When files are moved, the directory structure is preserved. Empty directories are ignored and deleted from the input directory.
- By default, artists with slashes in their name will have any slashes removed (e.g. `AC/DC -> ACDC`). Use the `-a` flag to ignore these files so you can handle them manually.
- Ignored files and files detected to have no artist are logged to the console last so you know which files to double-check.
- Using the `-o` flag without specifying a directory will move files to a directory named "processed" next to your input directory.
- Using the `-t` flag will **permanently delete all files in the input, output and ignored directories** (either the default directories or the ones defined with `-i`/`-o`).

This app assumes artists will be seperated by a `&`, `x`, `×`, `+`, `,`, `and`, or `with`. It also grabs any `feat.` artists included in the artist tag.

```
Artist 1 & Artist 2 x Artist 3 × Artist 4 feat. Artist 1 + Artist 2, Artist 3 and Artist 4
->
Artist 1/Artist 2/Artist 3/Artist 4/Artist 1/Artist 2/Artist 3/Artist 4
```

Note: If you look at the tags of a processed file via something like Windows Explorer (or a tag editor like Mp3tag), you will see artists seperated by semicolons, not slashes. This is normal. The artists are still separated by slashes in the actual tag data.
