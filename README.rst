nomnom 
=========================

`nomnom` is a chrome extension that builds image label/caption datasets for machine learning from *any* images your browser renders as you browse the internet.

.. image:: static/nomnom3.gif

The goal is to enable rapid creation of image datasets from the most abundant source (other people's websites) just by clicking (or not clicking) on images in a web page.

It's geared to enable the following tasks for a user:

 - quick generation of binary classification datasets (click vs no click) by dusing all images in a page as a "0 label"
 - saving and labelling *only* clicked images with custom, templatable captions

Your image and caption data is streamed to a server of your choice, enabling you to do funky shit like building an online data pipeline to stream images you like/dislike into a `GAN <https://en.wikipedia.org/wiki/Generative_adversarial_network>`_, if that's the kind of thing you're into on a Saturday night.


What `nomnom` does and doesn't do
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

`nomnom` is all about image (ingestion) and labelling based on user browsing behaviour on websites you chooses to monitor. So if you go to website X often enough to see images and want to store/label them for fine-tuning a stable diffusion model, you might have a use case for it. These `weirdos <https://www.unstability.ai/>`_ probably do.

`nomnom` isn't a tool like [Label Studio](https://labelstud.io/), which is cool but starts from having an image dataset. If you need an image labelling tool for an existing dataset, Label Studio is way better---but you could use `nomom` as a tool to add images to datasets for Label Studio, e.g. by streaming images from your browser to a server that writes them to a storage bucket. 

What's a `nomnom`?
~~~~~~~~~~~~~~~~~~

It's the sound you make as you gobble up images, *nomnomnomnom*.

Features
--------

.. list-table:: Features
  :widths: 15 25 50
  :header-rows: 1

  * - Type
    - Status
    - Summary

  * - Image URL Filtering
    - ✅
    - Images can be filtered by URL using regex `match patterns <https://developer.chrome.com/docs/extensions/mv2/match_patterns>`_

  * - Caption Templating
    - ✅
    - Captions can be templated using any match/replace string to simplify composing captions for stable-diffusion

  * - Save all or only clicked images
    - ✅
    - Can run in 2 modes: save-all or save-clicked. To build datasets of negative examples for image classification, it's possible to save all images loaded in a page even if unclicked.

  * - Remote Image Streaming
    - ✅
    - Post images & captions to a user-configurable server as you browse

  * - Local Image Storage
    - ✅
    - Save images and captions to a local `IndexedDB <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>`_ in Chrome

  * - Export Local Images
    - ❌
    - There's an upstream `bug <https://bugs.chromium.org/p/chromium/issues/detail?id=1368818>`_ in chromium that prevents exporting files into a local directory


Installation
------------

`nomnom` is a chrome extension that uses the (deprecated) `Manifest version 2 <https://developer.chrome.com/docs/extensions/mv2/>`_, so to install it you must `load an unpacked extension <https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked>`_:

1. Clone the repo

   ..code-block:: bash

       git clone https://github.com/mbhynes/nomnom

2. Open `chrome://extensions/ <chrome://extensions/>`_ in your browser

3. At the top right, check *"Developer Mode"*

4. At the left, click "Load unpacked" and select the `nomnom/` directory you just cloned into

Uninstallation
~~~~~~~~~~~~~~~
1. Open `chrome://extensions/ <chrome://extensions/>`_ in your browser

2. Choose "Remove" for the `nomnom` extension
