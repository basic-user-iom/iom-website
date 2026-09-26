# Mars longitude seam

The bundled 1024 x 512 Viking color JPEG has an invalid bright column at x=0.
At the equator that column is RGB (244, 219, 215), while its adjacent valid
columns are (158, 130, 127) and (158, 124, 122). Wrapping that source around
a sphere makes the gutter a bright pole-to-pole seam.

The asset explicitly declares one invalid left gutter column. Before uploading
the decoded texture, only the RGB values in that column are interpolated
between the last and first valid longitude columns. Alpha, dimensions, all
other pixels, UV coordinates and the original JPEG remain unchanged. Repair
happens before mipmap generation, so distant views cannot retain the stripe.

Evidence: tmp/mars-line-before (same lit-side view with grid, haze and normal
layers toggled independently); tmp/mars-line-after (same view after repair).
A regression test decodes the real source file, checks seam contrast reduction,
and verifies that every other column is unchanged.
