import React from 'react';

interface WhaleLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const WhaleLogo: React.FC<WhaleLogoProps> = ({ className, ...props }) => {
  return (
    <svg
      viewBox="0 0 800 800"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      {/* Whale silhouette — refined, flowing curves */}
      <g transform="translate(400,400)">
        {/* Main body */}
        <path d="
          M -60,-260
          C -20,-265 20,-258 70,-240
          C 120,-222 170,-190 210,-145
          C 250,-100 270,-48 275,10
          C 278,55 268,98 250,135
          C 235,168 215,190 190,205
          C 165,218 135,225 100,228
          C 60,230 15,225 -35,215
          C -80,205 -125,188 -160,165
          C -190,145 -215,118 -230,90
          C -248,58 -258,22 -260,-20
          C -262,-65 -258,-108 -245,-148
          C -232,-188 -210,-220 -180,-242
          C -148,-260 -110,-267 -60,-260
          Z
        " fill="currentColor" />
        {/* Tail flukes */}
        <path d="
          M -255,-20
          C -290,-60 -340,-100 -380,-120
          C -400,-130 -415,-128 -420,-115
          C -425,-102 -418,-88 -400,-78
          C -370,-62 -330,-40 -280,-15
        " fill="currentColor" />
        <path d="
          M -250,-20
          C -285,20 -330,50 -370,70
          C -390,82 -408,80 -415,68
          C -422,56 -415,42 -398,34
          C -370,22 -332,8 -282,0
        " fill="currentColor" />
        {/* Pectoral fin */}
        <path d="
          M 60,50
          C 50,90 35,150 15,200
          C 5,225 -5,235 -12,230
          C -19,225 -15,210 -3,185
          C 15,145 30,100 40,55
        " fill="currentColor" />
        {/* Eye */}
        <circle cx="170" cy="-50" r="18" fill="#FAFAF9" />
        {/* Mouth line */}
        <path d="
          M 250,-20
          C 255,-15 260,-10 270,-8
        " stroke="#FAFAF9" strokeWidth="6" strokeLinecap="round" fill="none" />
        {/* Water spray / spout */}
        <path d="
          M 180,-260
          C 175,-300 160,-340 140,-370
          C 130,-388 118,-395 112,-390
          C 106,-385 110,-370 122,-350
        " stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="
          M 200,-265
          C 205,-305 215,-345 230,-375
          C 240,-392 252,-400 258,-395
          C 264,-390 256,-375 245,-355
        " stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.4"/>
      </g>
    </svg>
  );
}
