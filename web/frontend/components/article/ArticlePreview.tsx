import axios from "axios";
import Link from "next/link";
import Router from "next/router";
import React from "react";
import useSWR from "swr";

import CustomLink from "../common/CustomLink";
import CustomImage from "../common/CustomImage";
import { usePageDispatch } from "../../lib/context/PageContext";
import checkLogin from "../../lib/utils/checkLogin";
import { SERVER_BASE_URL } from "../../lib/utils/constant";
import storage from "../../lib/utils/storage";

const FAVORITED_CLASS = "btn btn-sm btn-primary";
const NOT_FAVORITED_CLASS = "btn btn-sm btn-outline-primary";

const ArticlePreview = ({ article }) => {
  const setPage = usePageDispatch();

  const [preview, setPreview] = React.useState(article);
  const [hover, setHover] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(-1);

  const { data: currentUser } = useSWR("user", storage);
  const isLoggedIn = checkLogin(currentUser);

  const handleClickFavorite = async (slug) => {
    if (!isLoggedIn) {
      Router.push(`/user/login`);
      return;
    }

    setPreview({
      ...preview,
      favorited: !preview.favorited,
      favoritesCount: preview.favorited
        ? preview.favoritesCount - 1
        : preview.favoritesCount + 1,
    });

    try {
      if (preview.favorited) {
        await axios.delete(`${SERVER_BASE_URL}/articles/${slug}/favorite`, {
          headers: {
            Authorization: `Token ${currentUser?.token}`,
          },
        });
      } else {
        await axios.post(
          `${SERVER_BASE_URL}/articles/${slug}/favorite`,
          {},
          {
            headers: {
              Authorization: `Token ${currentUser?.token}`,
            },
          }
        );
      }
    } catch (error) {
      setPreview({
        ...preview,
        favorited: !preview.favorited,
        favoritesCount: preview.favorited
          ? preview.favoritesCount - 1
          : preview.favoritesCount + 1,
      });
    }
  };

  if (!article) return;

  return (
    <tr>
      <td>
        <span className="pull-xs-right">
          <button
            className={
              preview.favorited ? FAVORITED_CLASS : NOT_FAVORITED_CLASS
            }
            onClick={() => handleClickFavorite(preview.slug)}
          >
            <i className="ion-heart" /> {preview.favoritesCount}
          </button>
        </span>
      </td>
      <td>
        <CustomLink
          href="/profile/[pid]"
          as={`/profile/${preview.author.username}`}
        >
        <CustomImage
          src={preview.author.image}
          alt="author's profile image"
          style={{ height: "1.5em", ['vertical-align']: "middle" }}
        />
        &nbsp;
        {preview.author.username}
        </CustomLink>
      </td>
      <td>
        <CustomLink
          href="/article/[pid]"
          as={`/article/${preview.slug}`}
          className="preview-link"
        >
          {preview.title}
        </CustomLink>
      </td>
      <td>
        <span className="date">
          {new Date(preview.createdAt).toDateString()}
        </span>
      </td>
    </tr>
  );
};

export default ArticlePreview;
