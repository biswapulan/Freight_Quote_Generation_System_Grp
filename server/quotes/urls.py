"""URL routes for the quote-generation API."""

from django.urls import path

from .views import GenerateQuoteView, MyQuotesView

urlpatterns = [
    path('generate/', GenerateQuoteView.as_view(), name='generate-quote'),
    path('my-quotes/', MyQuotesView.as_view(), name='my-quotes'),
]
