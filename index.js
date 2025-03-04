const mix = require('laravel-mix')
const fs = require('fs-extra')
const path = require('path')
const glob = require('glob')
const sharp = require('sharp')
const imageSize = require('image-size')
const imagemin = require('imagemin')
const imageminJpegtran = require('imagemin-jpegtran')
const imageminPngquant = require('imagemin-pngquant')
const imageminWebp = require('imagemin-webp')

class SimpleImageProcessor {
    register(options = {}) {
        let {
            disable,
            source,
            destination,
            thumbnailsSizes,
            thumbnailsSuffix,
            thumbnailsOnly, // deprecated (do not use)
            processOriginalImage,
            webp,
            thumbnailsWebp,
            thumbnailsWebpOnly,
            imageminPngquantOptions,
            imageminWebpOptions,
        } = Object.assign({
            disable: false,
            source: 'resources/images',
            destination: 'public/images',
            thumbnailsSizes: [],
            thumbnailsSuffix: '@',
            thumbnailsOnly: false,
            processOriginalImage: null,
            webp: false,
            thumbnailsWebp: null,
            thumbnailsWebpOnly: false,
            imageminPngquantOptions: {
                quality: [0.3, 0.5]
            },
            imageminWebpOptions: {
                quality: 50
            },
        }, options)

        if (disable) {
            return
        }

        // `processOriginalImage` is now replacing `thumbnailsOnly` (which is now deprecated)
        // It is defaulting to `!thumbnailsOnly`, e.g. `true` if `thumbnailsOnly` is not specified
        processOriginalImage = processOriginalImage !== null ? !!processOriginalImage : !thumbnailsOnly

        // `thumbnailsWebp` can now be used instead of `webp` (defaulting to the `webp` value)
        thumbnailsWebp = thumbnailsWebp !== null ? !!thumbnailsWebp : webp

        thumbnailsSizes.sort((a, b) => (a > b) ? 1 : -1)

        if (processOriginalImage) {
            if (!fs.existsSync(destination)) {
                fs.mkdirSync(destination, { recursive: true });
            }

            fs.copySync(source, destination)
        }

        let warnings = false;

        glob.sync(source + '/**/*').forEach((fromImagePath) => {
            if (fromImagePath.match(/\.(jpe?g|png|gif)$/i) === null) {
                return
            }

            let {dir, ext, name} = path.parse(fromImagePath)
            let width = imageSize(fromImagePath).width
            let destinationFolder = destination + dir.replace(source, '') + '/'

            if (!fs.existsSync(destinationFolder)) {
                fs.mkdirSync(destinationFolder, { recursive: true });
            }

            thumbnailsSizes.forEach((w) => {
                if (width < w) {
                    warnings = true;
                    console.warn('mix.imgs() '+"\x1b[33m"+'WARN'+"\x1b[0m"+' Image "'+fromImagePath+'" (width: '+width+'px) is generating a thumbnail "'+destinationFolder+name+thumbnailsSuffix+w+ext+'" with a stretched resolution.')
                }

                sharp(fromImagePath)
                    .resize(w)
                    .toFile(destinationFolder + name + thumbnailsSuffix + w + ext)
            })

            let filesToOptimize = [];
            let filesConvertToWebp = [];

            if (thumbnailsSizes.length && !thumbnailsWebpOnly) {
                filesToOptimize.push(destinationFolder + name + thumbnailsSuffix + '*' + ext) // All thumbnails / resized images (from destination)
            }

            if (thumbnailsSizes.length && thumbnailsWebp) {
                filesConvertToWebp.push(destinationFolder + name + thumbnailsSuffix + '*' + ext) // All thumbnails / resized images (from destination)
            }

            if (processOriginalImage) {
                filesToOptimize.push(destinationFolder + name + ext) // Full sized image (from destination)
            }

            if (webp) {
                if (processOriginalImage) {
                    filesConvertToWebp.push(destinationFolder + name + ext) // Full sized image (from destination)
                } else {
                    filesConvertToWebp.push(fromImagePath) // Full sized image (from source)
                }
            }

            if (filesToOptimize.lenght) {
                imagemin(filesToOptimize, {
                    destination: destinationFolder,
                    plugins: [
                        imageminJpegtran(),
                        imageminPngquant(imageminPngquantOptions),
                    ],
                })
            }

            if (filesConvertToWebp.length) {
                imagemin(filesConvertToWebp, {
                    destination: destinationFolder,
                    plugins: [
                        imageminWebp(imageminWebpOptions)
                    ],
                }).then(function (r) {
                    if (thumbnailsWebp && thumbnailsWebpOnly) {
                        thumbnailsSizes.forEach((w) => {
                            // Delete all original thumbnail files
                            fs.unlinkSync(destinationFolder + name + thumbnailsSuffix + w + ext);
                        })
                    }
                })
            }
        })

        if (warnings) {
            console.log('')
        }
    }
}

mix.extend('imgs', new SimpleImageProcessor())
