# Vite Assets managements

When you reference assets files in your js or css files, you should remember that you need to use a relative path if you wants Vite process your file.
- **all your files defined with an absolute path will be ignored by Vite** and will be left as is in your build files. You can specify an absolute path relative to your public folder. this practice is not recommended because your asset files will not be versioned.
- **all your files defined with a relative path will be processed by Vite**. The paths are relative to the file where they are referenced. Any assets referenced via a relative path will be re-written, versioned, and bundled by Vite.

## Symfony Asset Component

Whenever you run a `build` with Vite, two configuration files are generated in your output folder (default location: public/build/):

- `manifest.json` : generated by the Manifest Plugin from vite internals
- `entrypoints.json` : generated by vite-plugin-symfony.

The `manifest.json` file is needed to get the versioned filename of assets files, like font files or image files.

so you can use [Symfony's Asset component](https://symfony.com/doc/current/components/asset.html) and its `asset` function to reference your assets in your Twig files.
To enable this association between Symfony and your `manifest.json` file, you will need to use `ViteAssetVersionStrategy`.

```yaml
# config/packages/framework.yaml
framework:
    assets:
        version_strategy: 'Pentatrion\ViteBundle\Asset\ViteAssetVersionStrategy'

```

You can then use the `asset()` Twig function by specifing your asset file path relative to your `root` path specified in your `vite.config.js`. (for compatibility reason with vite generated `manifest.json` file)

```twig
<body>
    <img src="{{ asset('assets/images/avatar.jpg') }}" />
</body>
```
You can use this `asset()` function **only with assets referenced by JavaScript or CSS files**. The `manifest.json` file is generated during the compilation step of your JavaScript code by Vite. It's a kind of summary of the files it processed. If your file is not referenced anywhere it will not appear in the `manifest.json`.

If you want to make Vite aware of others assets you can import a directory of assets into your application's entry point. For example il you want to version all images stored in `assets/images` you could add the following in your `app` entrypoint. (I do not really recommend this method but rather the following one by defining multiple strategies)

Please note, by default Vite will make all its assets smaller than 4kb inline, so you will not be able to reference these files. (see explanations and solution in [troubleshooting](/guide/troubleshooting.html#troubleshooting)).

```
├──assets
│ ├──images
│ │ ├──climbing.jpg
│ │ ├──violin.jpg
│ │ ├──...
│ │
│ ├──app.js
│...
```

```js
// assets/app.js
import.meta.glob([
    './images/**'
]);
```

## Multiple asset strategies

if you want to use the [Twig asset function](https://symfony.com/doc/current/reference/twig_reference.html#asset) to serve assets from Vite but you want to serve other assets that come from another source you can define multiple strategies.

```yaml
# config/packages/framework.yaml
framework:
    assets:
        packages:
            vite:
                version_strategy: 'Pentatrion\ViteBundle\Asset\ViteAssetVersionStrategy'
```

```twig
{# Vite asset version strategy #}
{{ asset('assets/images/avatar.jpg', 'vite') }}

{# default strategy #}
{{ asset('other-location/logo.svg')}}
```
