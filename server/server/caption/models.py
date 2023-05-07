import os
import uuid
import re

from urllib import parse
from django.db import models

from django.conf import settings

from django.core.validators import URLValidator


def get_canonical_image_url(url):
    if not url or url.startswith('data:'):
        return None
    parsed = parse.urlparse(url)
    if parsed.hostname == 'encrypted-tbn0.gstatic.com':
        path = parse.parse_qs(parsed.query).get('q', [''])[0]
    elif parsed.hostname == 'external-content.duckduckgo.com':
        path = parse.parse_qs(parsed.query).get('u', [''])[0]
    else:
        path = parsed.path
    return parse.urljoin(parsed.hostname, path)

def make_image_path(instance, filename):
    url = get_canonical_image_url(instance.url)
    surrogate_filename = str(Image.hash_url(url))
    ext = os.path.splitext(filename)[-1]
    return surrogate_filename + ext


class MaybeDataUrlValidator(URLValidator):
    def __call__(self, value):
        # skip validation if value matches a Data Url regex
        if re.match(r'^data:[^;]+;base64,', value):
            return
        super().__call__(value)


class Image(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    url = models.URLField(max_length=2048, null=True, validators=[MaybeDataUrlValidator()])
    img = models.ImageField(upload_to=make_image_path, null=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )

    @staticmethod
    def hash_url(url):
        if url:
            return uuid.uuid5(uuid.NAMESPACE_URL, get_canonical_image_url(url))
        return uuid.uuid4()

    def save(self, *args, **kwargs):
        self.id = self.hash_url(self.url)
        super().save(*args, **kwargs)


class Caption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.TextField(blank=True, null=False)
    key = models.IntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )

    @staticmethod
    def hash_text(text):
        return uuid.uuid5(uuid.NAMESPACE_URL, text or '')

    def save(self, *args, **kwargs):
        self.id = self.hash_text(self.text)
        super().save(*args, **kwargs)


class ImageCaption(models.Model):

    class EventType(models.TextChoices):
        VIEW = "view"
        CLICK = "click"

    event_type = models.CharField(max_length=2**4, choices=EventType.choices)
    initiator = models.TextField(blank=True, null=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    count = models.IntegerField(null=False, default=0)
    caption = models.ForeignKey(Caption, on_delete=models.CASCADE)
    image = models.ForeignKey(Image, on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
