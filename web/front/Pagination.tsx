import React from 'react'
import { trigger } from 'swr'

import Maybe from 'front/Maybe'

interface PaginationProps {
  articlesCount: number;
  articlesPerPage: number;
  showPagesMax: number;
  currentPage: number;
  urlFunc: (number) => string;
}

function PaginationItem(props) {
  const newProps = Object.assign({}, props)
  delete newProps.children
  delete newProps.className
  let className;
  if (props.className) {
    className = ' ' + props.className
  } else {
    className = ''
  }
  return <>
    <span className={`page-item${className}`} {...newProps}>
      <a href={props.href} className="page-link">{props.children}</a>
    </span>
    {' '}
  </>
}

export const getRange = (start, end) => {
  return [...Array(end - start + 1)].map((_, i) => start + i);
};


const Pagination = ({
  articlesCount,
  articlesPerPage,
  showPagesMax,
  currentPage,
  urlFunc,
}: PaginationProps) => {
  // - totalPages
  // - firstPage: 0-indexed
  // - lastPage: 0-indexed, inclusive
  const totalPages = Math.ceil(articlesCount / articlesPerPage)
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  let firstPage = Math.max(0, currentPage - Math.floor(showPagesMax / 2));
  let lastPage = Math.min(totalPages - 1, currentPage + Math.floor(showPagesMax / 2));
  if (lastPage - firstPage + 1 < showPagesMax) {
    if (currentPage < totalPages / 2) {
      lastPage = Math.min(
        totalPages - 1,
        lastPage + (showPagesMax - (lastPage - firstPage))
      );
    } else {
      firstPage = Math.max(1, firstPage - (showPagesMax - (lastPage - firstPage)));
    }
  }
  if (lastPage - firstPage + 1 > showPagesMax) {
    if (currentPage > totalPages / 2) {
      firstPage = firstPage + 1;
    } else {
      lastPage = lastPage - 1;
    }
  }

  const pages = articlesCount > 0 ? getRange(firstPage, lastPage) : [];
  return (
    <nav>
      <ul className="pagination">
        <Maybe test={firstPage > 0}>
          <PaginationItem href={urlFunc(0)}>{`<<`}</PaginationItem>
        </Maybe>
        <Maybe test={currentPage > 0}>
          <PaginationItem href={urlFunc(currentPage + 1)}>{`<`}</PaginationItem>
        </Maybe>
        {pages.map(page => {
          const isCurrent = page === currentPage;
          return (
            <PaginationItem
              key={page.toString()}
              className={isCurrent && "active"}
              href={urlFunc(page + 1)}
            >
              {page + 1}
            </PaginationItem>
          );
        })}
        <Maybe test={currentPage < totalPages - 1}>
          <PaginationItem  href={urlFunc(currentPage + 2)}>{`>`}</PaginationItem>
        </Maybe>
        <Maybe test={lastPage < totalPages - 1}>
          <PaginationItem href={urlFunc(totalPages)}>{`>>`}</PaginationItem>
        </Maybe>
      </ul>
    </nav>
  );
};

export default Pagination;
