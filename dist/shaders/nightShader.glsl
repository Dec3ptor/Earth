#version 300 es

#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    precision highp int;
#else
    precision mediump float;
    precision mediump int;
    #define highp mediump
#endif

uniform sampler2D u_texture;
uniform float u_nightAlpha;
in vec2 v_textureCoordinates;
out vec4 fragColor;

void main() {
    vec4 color = texture(u_texture, v_textureCoordinates);
    float alpha = u_nightAlpha;
    
    // Assuming the lighting condition can be derived from the color intensity
    float intensity = dot(color.rgb, vec3(0.299, 0.587, 0.114)); // Luminance approximation
    alpha *= 1.0 - intensity; // Adjust alpha based on luminance

    fragColor = vec4(color.rgb, alpha);
}
