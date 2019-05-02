[site](verillious.github.io/terrain)
[demo](html/index.html)

# This is a fork of mewo2/terrain, created:
* because the owner (Martin O'Leary) considers it to be complete
    and has moved on to other projects.
* I want to take it in a slightly different direction.
    The creator's goal was a fantasy Atlas.  My goal is to create a
    plausible geograpic/resource/village/trade foundation for FRPG
    development.
* I want to find a way to make it easier for other people to
    change design decision parameters and engines (so they can
    change the way that worlds unfold).

# Original Creator Information and License

Martin O'leary (mewo2), drawing on D3 and Adam Hooper's js-priority-queue.

This project is, from my perspective, finished.

The code is available under the [MIT license](license), so you can fork it,
improve it, learn from it, build upon it. However, I have no interest in
maintaining it as an ongoing open source project, nor in providing support for
it. Pull requests will be either ignored or closed.

If you do make something interesting with this code, please do still let me know! I'm sorry that I can't provide any support, but I am still genuinely interested in seeing creative applications of the code.

[uncharted](https://twitter.com/unchartedatlas)

[notes](https://mewo2.com/notes/terrain/)

[license](https://github.com/mewo2/terrain/blob/master/LICENSE.md)

# My Intentions
1. comment the original (to help me understand it).
2. refactor it into smaller modules (to make it easier to work on).
3. modeling enhancements
   * sedimentation and soil development
   * valuable mineral deposits
   * flora generation
   * herbavore generation
   * carnivore generation
4. usage enhancements
   * adapt it for use in a try-and-tweak world-generation model.
   * enable it to export a variety of map overlays.

# Status

In June I concluded that I could learn a great deal from mewo2's code
(he came up with several simplifying assumptions that greatly reduced
computation while still yielding satisfying results), but that Javascript
was not the language in which I was going to build a GUI world editor that
loaded and produced local files.  In July I started working on a Java
WorldBuilder: https://github.com/markkampe/Java_Terrain/ .

That is coming along nicely, and once I have it doing what I need, I will
return to finish the re-module-ization and commenting of this fork.

