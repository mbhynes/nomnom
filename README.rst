``nomnom``
=========================

``nomnom`` is a chrome extension that builds image label/caption datasets for machine learning from *any* images your browser renders as you browse the internet.

The goal is to enable rapid creation of image datasets from the most abundant source (other people's websites) just by clicking (or not clicking) on images in a web page, to enable:

- quick generation of binary classification datasets (click vs no click) by dusing all images in a page as a "0 label"
- saving and labelling *only* clicked images with custom, templatable captions

Your image and caption data is streamed to a server of your choice, enabling you to do funky shit like building an online data pipeline to stream images you like/dislike into a `GAN <https://en.wikipedia.org/wiki/Generative_adversarial_network>`_, if that's the kind of thing you're into on a Saturday night.

.. image:: static/nomnom3.gif

Goals
-----

What ``nomnom`` does
~~~~~~~~~~~~~~~~~~~~

``nomnom`` is all about image (ingestion) and labelling based on user browsing behaviour on websites you chooses to monitor. So if you go to website X often enough to see images and want to store/label them for fine-tuning a stable diffusion model, you might have a use case for it. These `weirdos <https://www.unstability.ai/>`_ probably do.

What ``nomnom`` doesn't do
~~~~~~~~~~~~~~~~~~~~~~~~~~

``nomnom`` isn't a tool like `Label Studio <https://labelstud.io/>`_, which is cool but starts from having an image dataset. If you need an image labelling tool for an existing dataset, Label Studio is way better---but you could use ``nomom`` as a tool to add images to datasets for Label Studio, e.g. by streaming images from your browser to a server that writes them to a storage bucket. 


Features
--------

.. list-table::
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
    - There's an upstream `bug <https://bugs.chromium.org/p/chromium/issues/detail?id=1368818>`_ in chromium that prevents exporting files into a local directory.


Installation
------------

`nomnom` is a chrome extension that uses the (deprecated) `Manifest version 2 <https://developer.chrome.com/docs/extensions/mv2/>`_, so to install it you must `load an unpacked extension <https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked>`_:

1. Clone the repo

    .. code-block:: bash

       git clone https://github.com/mbhynes/nomnom

2. Open `chrome://extensions/ <chrome://extensions/>`_ in your browser

3. At the top right, check *"Developer Mode"*

4. At the left, click *"Load unpacked"* and select the directory you just cloned into

Uninstallation
~~~~~~~~~~~~~~~
1. Open `chrome://extensions/ <chrome://extensions/>`_ in your browser

2. Choose "Remove" for the `nomnom` extension

Server Configuration
--------------------
A remote (or local) hostname may be provided to the extension to stream images and captions to.

The server must be configured with the following endpoints:

- ``auth-token/``

  - Purpose: authenticate a user and return an auth token
  - Accepts: ``POST``
  - Payload: ``{"username": "<your_username>", "password": "<your_password>"}``
  - Response: ``{"token": "<an_auth_token>"}``

- ``check-token/``

  - Purpose: check if a token is valid, returning 200 if so
  - Accepts: ``GET``
  - Headers: ``{"Content-Type": "application/json", "Authorization": "Token <an_auth_token>"}``
  - Response: A 200 status if the token is valid.

- ``image/``

  - Purpose: receive an image and caption data
  - Accepts: ``POST``
  - Headers: ``{"Content-Type": "application/json", "Authorization": "Token <an_auth_token>"}``
  - Payload:

    .. code-block::

      {
        "url":          "<the_url_of_the_image>",
        "initiator":    "<referring site from which the request was placed>",
        "img":          <Blob>,
        "view_events":  [
          {
            "timestamp":    "<epoch-millisecond timestamp of the event>",
            "caption":      "<string caption for the image>",
            "captionKey":   "<a local hash of the caption for local correspondence in the IndexedDB>",
            "count":        <an integer value of +1 or -1 representing the net difference in event count;
                            a negative value encodes a count adjustment since a user may "unclick"
                            an image to indicate that a previous click should be annulled.>
          },
        ]
        "click_events": [
          {
            "timestamp":    "<epoch-millisecond timestamp of the event>",
            "caption":      "<string caption for the image>",
            "captionKey":   "<a local hash of the caption for local correspondence in the IndexedDB>",
            "count":        <an integer value of +1 or -1 representing the net difference in event count;
                            a negative value encodes a count adjustment since a user may "unclick"
                            an image to indicate that a previous click should be annulled.>
          },
        ]
      }


Why the name ``nomnom``?
------------------------

It's the sound you make as you gobble up images, *nomnomnomnom*.
