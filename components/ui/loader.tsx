"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
const loaderVariants=cva("motion-safe:animate-spin motion-reduce:animate-none",{variants:{size:{xs:"size-3",sm:"size-4",md:"size-5",lg:"size-6",xl:"size-8"},variant:{default:"text-foreground",primary:"text-primary",secondary:"text-secondary-foreground",muted:"text-muted-foreground"}},defaultVariants:{size:"md",variant:"default"}});
export interface LoaderProps extends React.SVGAttributes<SVGSVGElement>,VariantProps<typeof loaderVariants>{}
const Loader=React.forwardRef<SVGSVGElement,LoaderProps>(({className,size,variant,...props},ref)=><LoaderCircle ref={ref} className={cn(loaderVariants({size,variant}),className)} aria-hidden="true" {...props}/>);
Loader.displayName="Loader";
export {Loader,loaderVariants};
