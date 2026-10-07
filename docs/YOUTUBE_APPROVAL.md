# YouTube posting: getting it approved for everyone

Until both approvals below come through, videos posted from the game are held
as private and only listed test users can connect. Keep `VITE_YOUTUBE_DIRECT`
off for the public until then.

## 1. Before you apply

- guessglobe.com verified in Google Search Console, with the same Google
  account that owns the Cloud project.
- Google Auth Platform → Branding filled in:
  - App name: GuessGlobe
  - Home page: https://guessglobe.com
  - Privacy policy: https://guessglobe.com/privacy
  - Terms of service: https://guessglobe.com/terms
  - Authorized domain: guessglobe.com
  - Support and developer contact emails
- Data Access lists exactly one scope: `.../auth/youtube.upload`.

## 2. The demo video

About two minutes, screen recorded, uploaded to YouTube as **Unlisted**. Use a
test-user account. Keep the browser address bar visible the whole time.

1. Open https://guessglobe.com and say what it is: a geography game.
2. Play a short round and finish it.
3. Press Share video, then YouTube.
4. Press Connect YouTube and post. Pause on the Google consent screen so the
   address bar (with the client ID) and the one permission asked ("upload
   videos") are readable.
5. Approve. Show the progress, then the "Posted" button.
6. Open the video on the YouTube channel.
7. Open https://guessglobe.com/privacy and scroll to "If you post a video to
   YouTube".

## 3. OAuth verification (Verification Center)

**Why is `youtube.upload` needed?**

> GuessGlobe is a geography game. When a player finishes a round, they can
> press Share video and post a short video of that round to their own YouTube
> channel. The youtube.upload scope is the narrowest scope that lets the
> player's own upload go through. The game never reads, lists, changes or
> deletes anything on the channel.

**How is the data used and stored?**

> The access token is requested only when the player presses Connect
> YouTube, is held in the browser's memory for the visit (about one hour) and
> is never stored on our servers or in a database. The video goes from the
> player's browser directly to YouTube. We do not receive or keep the
> player's channel, email or profile from YouTube.

Then publish the app: Audience → Publish app.

## 4. YouTube API Services audit and quota extension

Form: search for "YouTube API Services Audit and Quota Extension Form".
This is the step that removes the private lock on API uploads and raises the
daily quota. It is separate from OAuth verification; send both.

**What the app does**

> A browser game. After a round, the player can upload a short video of their
> own round to their own YouTube channel. Uploads happen only when the player
> presses Post, with the title and visibility the player chose. No other
> YouTube API method is called.

**Quota**

`videos.insert` has its own quota, counted in uploads: Google's quota page says
one call costs 1 unit and the default is 100 uploads a day (re-check it on the
"here" link in the form, it has changed before). The form asks for it
separately from the general 10,000 units, so request a number of uploads per
day (we asked for 500) and leave the general quota at 10,000. Keep the "Expected
API Usage Volume" range in line with it. Ask again when you outgrow it. No
quota is unlimited.

Submitted on 2026-10-07 (the second attempt; the first showed no confirmation).

**Links to give**

- Terms: https://guessglobe.com/terms
- Privacy: https://guessglobe.com/privacy
- The unlisted demo video from step 2.

## 5. When both are approved

1. Post one video from a finished round. Check it is public in YouTube Studio.
2. Set `VITE_YOUTUBE_DIRECT=1` in Vercel for all environments, and redeploy
   without the build cache.
3. Remove or shrink "Upload by hand instead" if you like.
